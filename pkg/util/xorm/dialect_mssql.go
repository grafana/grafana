// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"xorm.io/core"
)

var (
	mssqlReservedWords = map[string]bool{
		"ADD":                            true,
		"EXTERNAL":                       true,
		"PROCEDURE":                      true,
		"ALL":                            true,
		"FETCH":                          true,
		"PUBLIC":                         true,
		"ALTER":                          true,
		"FILE":                           true,
		"RAISERROR":                      true,
		"AND":                            true,
		"FILLFACTOR":                     true,
		"READ":                           true,
		"ANY":                            true,
		"FOR":                            true,
		"READTEXT":                       true,
		"AS":                             true,
		"FOREIGN":                        true,
		"RECONFIGURE":                    true,
		"ASC":                            true,
		"FREETEXT":                       true,
		"REFERENCES":                     true,
		"AUTHORIZATION":                  true,
		"FREETEXTTABLE":                  true,
		"REPLICATION":                    true,
		"BACKUP":                         true,
		"FROM":                           true,
		"RESTORE":                        true,
		"BEGIN":                          true,
		"FULL":                           true,
		"RESTRICT":                       true,
		"BETWEEN":                        true,
		"FUNCTION":                       true,
		"RETURN":                         true,
		"BREAK":                          true,
		"GOTO":                           true,
		"REVERT":                         true,
		"BROWSE":                         true,
		"GRANT":                          true,
		"REVOKE":                         true,
		"BULK":                           true,
		"GROUP":                          true,
		"RIGHT":                          true,
		"BY":                             true,
		"HAVING":                         true,
		"ROLLBACK":                       true,
		"CASCADE":                        true,
		"HOLDLOCK":                       true,
		"ROWCOUNT":                       true,
		"CASE":                           true,
		"IDENTITY":                       true,
		"ROWGUIDCOL":                     true,
		"CHECK":                          true,
		"IDENTITY_INSERT":                true,
		"RULE":                           true,
		"CHECKPOINT":                     true,
		"IDENTITYCOL":                    true,
		"SAVE":                           true,
		"CLOSE":                          true,
		"IF":                             true,
		"SCHEMA":                         true,
		"CLUSTERED":                      true,
		"IN":                             true,
		"SECURITYAUDIT":                  true,
		"COALESCE":                       true,
		"INDEX":                          true,
		"SELECT":                         true,
		"COLLATE":                        true,
		"INNER":                          true,
		"SEMANTICKEYPHRASETABLE":         true,
		"COLUMN":                         true,
		"INSERT":                         true,
		"SEMANTICSIMILARITYDETAILSTABLE": true,
		"COMMIT":                         true,
		"INTERSECT":                      true,
		"SEMANTICSIMILARITYTABLE":        true,
		"COMPUTE":                        true,
		"INTO":                           true,
		"SESSION_USER":                   true,
		"CONSTRAINT":                     true,
		"IS":                             true,
		"SET":                            true,
		"CONTAINS":                       true,
		"JOIN":                           true,
		"SETUSER":                        true,
		"CONTAINSTABLE":                  true,
		"KEY":                            true,
		"SHUTDOWN":                       true,
		"CONTINUE":                       true,
		"KILL":                           true,
		"SOME":                           true,
		"CONVERT":                        true,
		"LEFT":                           true,
		"STATISTICS":                     true,
		"CREATE":                         true,
		"LIKE":                           true,
		"SYSTEM_USER":                    true,
		"CROSS":                          true,
		"LINENO":                         true,
		"TABLE":                          true,
		"CURRENT":                        true,
		"LOAD":                           true,
		"TABLESAMPLE":                    true,
		"CURRENT_DATE":                   true,
		"MERGE":                          true,
		"TEXTSIZE":                       true,
		"CURRENT_TIME":                   true,
		"NATIONAL":                       true,
		"THEN":                           true,
		"CURRENT_TIMESTAMP":              true,
		"NOCHECK":                        true,
		"TO":                             true,
		"CURRENT_USER":                   true,
		"NONCLUSTERED":                   true,
		"TOP":                            true,
		"CURSOR":                         true,
		"NOT":                            true,
		"TRAN":                           true,
		"DATABASE":                       true,
		"NULL":                           true,
		"TRANSACTION":                    true,
		"DBCC":                           true,
		"NULLIF":                         true,
		"TRIGGER":                        true,
		"DEALLOCATE":                     true,
		"OF":                             true,
		"TRUNCATE":                       true,
		"DECLARE":                        true,
		"OFF":                            true,
		"TRY_CONVERT":                    true,
		"DEFAULT":                        true,
		"OFFSETS":                        true,
		"TSEQUAL":                        true,
		"DELETE":                         true,
		"ON":                             true,
		"UNION":                          true,
		"DENY":                           true,
		"OPEN":                           true,
		"UNIQUE":                         true,
		"DESC":                           true,
		"OPENDATASOURCE":                 true,
		"UNPIVOT":                        true,
		"DISK":                           true,
		"OPENQUERY":                      true,
		"UPDATE":                         true,
		"DISTINCT":                       true,
		"OPENROWSET":                     true,
		"UPDATETEXT":                     true,
		"DISTRIBUTED":                    true,
		"OPENXML":                        true,
		"USE":                            true,
		"DOUBLE":                         true,
		"OPTION":                         true,
		"USER":                           true,
		"DROP":                           true,
		"OR":                             true,
		"VALUES":                         true,
		"DUMP":                           true,
		"ORDER":                          true,
		"VARYING":                        true,
		"ELSE":                           true,
		"OUTER":                          true,
		"VIEW":                           true,
		"END":                            true,
		"OVER":                           true,
		"WAITFOR":                        true,
		"ERRLVL":                         true,
		"PERCENT":                        true,
		"WHEN":                           true,
		"ESCAPE":                         true,
		"PIVOT":                          true,
		"WHERE":                          true,
		"EXCEPT":                         true,
		"PLAN":                           true,
		"WHILE":                          true,
		"EXEC":                           true,
		"PRECISION":                      true,
		"WITH":                           true,
		"EXECUTE":                        true,
		"PRIMARY":                        true,
		"WITHIN":                         true,
		"EXISTS":                         true,
		"PRINT":                          true,
		"WRITETEXT":                      true,
		"EXIT":                           true,
		"PROC":                           true,
	}
)

type mssql struct {
	core.Base
}

func (db *mssql) Init(d *core.DB, uri *core.Uri, drivername, dataSourceName string) error {
	return db.Base.Init(d, db, uri, drivername, dataSourceName)
}

func (db *mssql) SqlType(c *core.Column) string {
	var res string
	switch t := c.SQLType.Name; t {
	case core.Bool:
		res = core.Bit
		if strings.EqualFold(c.Default, "true") {
			c.Default = "1"
		} else if strings.EqualFold(c.Default, "false") {
			c.Default = "0"
		}
	case core.Serial:
		c.IsAutoIncrement = true
		c.IsPrimaryKey = true
		c.Nullable = false
		res = core.Int
	case core.BigSerial:
		c.IsAutoIncrement = true
		c.IsPrimaryKey = true
		c.Nullable = false
		res = core.BigInt
	case core.Bytea, core.Blob, core.Binary, core.TinyBlob, core.MediumBlob, core.LongBlob:
		res = core.VarBinary
		if c.Length == 0 {
			c.Length = 50
		}
	case core.TimeStamp:
		res = core.DateTime
	case core.TimeStampz:
		res = "DATETIMEOFFSET"
		c.Length = 7
	case core.MediumInt:
		res = core.Int
	case core.Text, core.MediumText, core.TinyText, core.LongText, core.Json:
		res = core.Varchar + "(MAX)"
	case core.Double:
		res = core.Real
	case core.Uuid:
		res = core.Varchar
		c.Length = 40
	case core.TinyInt:
		res = core.TinyInt
		c.Length = 0
	case core.BigInt:
		res = core.BigInt
		c.Length = 0
	default:
		res = t
	}

	if res == core.Int {
		return core.Int
	}

	hasLen1 := (c.Length > 0)
	hasLen2 := (c.Length2 > 0)

	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}
	return res
}

func (db *mssql) SupportInsertMany() bool {
	return true
}

func (db *mssql) IsReserved(name string) bool {
	_, ok := mssqlReservedWords[name]
	return ok
}

func (db *mssql) Quote(name string) string {
	return "\"" + name + "\""
}

func (db *mssql) SupportEngine() bool {
	return false
}

func (db *mssql) AutoIncrStr() string {
	return "IDENTITY"
}

func (db *mssql) DropTableSql(tableName string) string {
	return fmt.Sprintf("IF EXISTS (SELECT * FROM sysobjects WHERE id = "+
		"object_id(N'%s') and OBJECTPROPERTY(id, N'IsUserTable') = 1) "+
		"DROP TABLE \"%s\"", tableName, tableName)
}

func (db *mssql) SupportCharset() bool {
	return false
}

func (db *mssql) IndexOnTable() bool {
	return true
}

func (db *mssql) IndexCheckSql(tableName, idxName string) (string, []interface{}) {
	args := []interface{}{idxName}
	sql := "select name from sysindexes where id=object_id('" + tableName + "') and name=?"
	return sql, args
}

/*func (db *mssql) ColumnCheckSql(tableName, colName string) (string, []interface{}) {
	args := []interface{}{tableName, colName}
	sql := `SELECT "COLUMN_NAME" FROM "INFORMATION_SCHEMA"."COLUMNS" WHERE "TABLE_NAME" = ? AND "COLUMN_NAME" = ?`
	return sql, args
}*/

func (db *mssql) IsColumnExist(tableName, colName string) (bool, error) {
	query := `SELECT "COLUMN_NAME" FROM "INFORMATION_SCHEMA"."COLUMNS" WHERE "TABLE_NAME" = ? AND "COLUMN_NAME" = ?`

	return db.HasRecords(query, tableName, colName)
}

func (db *mssql) TableCheckSql(tableName string) (string, []interface{}) {
	args := []interface{}{}
	sql := "select * from sysobjects where id = object_id(N'" + tableName + "') and OBJECTPROPERTY(id, N'IsUserTable') = 1"
	return sql, args
}

func (db *mssql) GetColumns(tableName string) ([]string, map[string]*core.Column, error) {
	args := []interface{}{}
	s := `select a.name as name, b.name as ctype,a.max_length,a.precision,a.scale,a.is_nullable as nullable,
		  "default_is_null" = (CASE WHEN c.text is null THEN 1 ELSE 0 END),
	      replace(replace(isnull(c.text,''),'(',''),')','') as vdefault,
		  ISNULL(i.is_primary_key, 0), a.is_identity as is_identity
          from sys.columns a 
		  left join sys.types b on a.user_type_id=b.user_type_id
          left join sys.syscomments c on a.default_object_id=c.id
		  LEFT OUTER JOIN 
    sys.index_columns ic ON ic.object_id = a.object_id AND ic.column_id = a.column_id
		  LEFT OUTER JOIN 
    sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          where a.object_id=object_id('` + tableName + `')`
	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	cols := make(map[string]*core.Column)
	colSeq := make([]string, 0)
	for rows.Next() {
		var name, ctype, vdefault string
		var maxLen, precision, scale int
		var nullable, isPK, defaultIsNull, isIncrement bool
		err = rows.Scan(&name, &ctype, &maxLen, &precision, &scale, &nullable, &defaultIsNull, &vdefault, &isPK, &isIncrement)
		if err != nil {
			return nil, nil, err
		}

		col := new(core.Column)
		col.Indexes = make(map[string]int)
		col.Name = strings.Trim(name, "` ")
		col.Nullable = nullable
		col.DefaultIsEmpty = defaultIsNull
		if !defaultIsNull {
			col.Default = vdefault
		}
		col.IsPrimaryKey = isPK
		col.IsAutoIncrement = isIncrement
		ct := strings.ToUpper(ctype)
		if ct == "DECIMAL" {
			col.Length = precision
			col.Length2 = scale
		} else {
			col.Length = maxLen
		}
		switch ct {
		case "DATETIMEOFFSET":
			col.SQLType = core.SQLType{Name: core.TimeStampz, DefaultLength: 0, DefaultLength2: 0}
		case "NVARCHAR":
			col.SQLType = core.SQLType{Name: core.NVarchar, DefaultLength: 0, DefaultLength2: 0}
		case "IMAGE":
			col.SQLType = core.SQLType{Name: core.VarBinary, DefaultLength: 0, DefaultLength2: 0}
		default:
			if _, ok := core.SqlTypes[ct]; ok {
				col.SQLType = core.SQLType{Name: ct, DefaultLength: 0, DefaultLength2: 0}
			} else {
				return nil, nil, fmt.Errorf("Unknown colType %v for %v - %v", ct, tableName, col.Name)
			}
		}

		cols[col.Name] = col
		colSeq = append(colSeq, col.Name)
	}
	return colSeq, cols, nil
}

func (db *mssql) GetTables() ([]*core.Table, error) {
	args := []interface{}{}
	s := `select name from sysobjects where xtype ='U'`
	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make([]*core.Table, 0)
	for rows.Next() {
		table := core.NewEmptyTable()
		var name string
		err = rows.Scan(&name)
		if err != nil {
			return nil, err
		}
		table.Name = strings.Trim(name, "` ")
		tables = append(tables, table)
	}
	return tables, nil
}

func (db *mssql) GetIndexes(tableName string) (map[string]*core.Index, error) {
	args := []interface{}{tableName}
	s := `SELECT
IXS.NAME                    AS  [INDEX_NAME],
C.NAME                      AS  [COLUMN_NAME],
IXS.is_unique AS [IS_UNIQUE]
FROM SYS.INDEXES IXS
INNER JOIN SYS.INDEX_COLUMNS   IXCS
ON IXS.OBJECT_ID=IXCS.OBJECT_ID  AND IXS.INDEX_ID = IXCS.INDEX_ID
INNER   JOIN SYS.COLUMNS C  ON IXS.OBJECT_ID=C.OBJECT_ID
AND IXCS.COLUMN_ID=C.COLUMN_ID
WHERE IXS.TYPE_DESC='NONCLUSTERED' and OBJECT_NAME(IXS.OBJECT_ID) =?
`
	db.LogSQL(s, args)

	rows, err := db.DB().Query(s, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indexes := make(map[string]*core.Index, 0)
	for rows.Next() {
		var indexType int
		var indexName, colName, isUnique string

		err = rows.Scan(&indexName, &colName, &isUnique)
		if err != nil {
			return nil, err
		}

		i, err := strconv.ParseBool(isUnique)
		if err != nil {
			return nil, err
		}

		if i {
			indexType = core.UniqueType
		} else {
			indexType = core.IndexType
		}

		colName = strings.Trim(colName, "` ")
		var isRegular bool
		if strings.HasPrefix(indexName, "IDX_"+tableName) || strings.HasPrefix(indexName, "UQE_"+tableName) {
			indexName = indexName[5+len(tableName):]
			isRegular = true
		}

		var index *core.Index
		var ok bool
		if index, ok = indexes[indexName]; !ok {
			index = new(core.Index)
			index.Type = indexType
			index.Name = indexName
			index.IsRegular = isRegular
			indexes[indexName] = index
		}
		index.AddColumn(colName)
	}
	return indexes, nil
}

func (db *mssql) CreateTableSql(table *core.Table, tableName, storeEngine, charset string) string {
	var sql string
	if tableName == "" {
		tableName = table.Name
	}

	sql = "IF NOT EXISTS (SELECT [name] FROM sys.tables WHERE [name] = '" + tableName + "' ) CREATE TABLE "

	sql += db.Quote(tableName) + " ("

	pkList := table.PrimaryKeys

	for _, colName := range table.ColumnsSeq() {
		col := table.GetColumn(colName)
		if col.IsPrimaryKey && len(pkList) == 1 {
			sql += col.String(db)
		} else {
			sql += col.StringNoPk(db)
		}
		sql = strings.TrimSpace(sql)
		sql += ", "
	}

	if len(pkList) > 1 {
		sql += "PRIMARY KEY ( "
		sql += strings.Join(pkList, ",")
		sql += " ), "
	}

	sql = sql[:len(sql)-2] + ")"
	sql += ";"
	return sql
}

func (db *mssql) ForUpdateSql(query string) string {
	return query
}

func (db *mssql) Filters() []core.Filter {
	return []core.Filter{&core.IdFilter{}, &core.QuoteFilter{}}
}

type odbcDriver struct {
}

func (p *odbcDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	var dbName string

	if strings.HasPrefix(dataSourceName, "sqlserver://") {
		u, err := url.Parse(dataSourceName)
		if err != nil {
			return nil, err
		}
		dbName = u.Query().Get("database")
	} else {
		kv := strings.Split(dataSourceName, ";")
		for _, c := range kv {
			vv := strings.Split(strings.TrimSpace(c), "=")
			if len(vv) == 2 {
				switch strings.ToLower(vv[0]) {
				case "database":
					dbName = vv[1]
				}
			}
		}
	}
	if dbName == "" {
		return nil, errors.New("no db name provided")
	}
	return &core.Uri{DbName: dbName, DbType: core.MSSQL}, nil
}
