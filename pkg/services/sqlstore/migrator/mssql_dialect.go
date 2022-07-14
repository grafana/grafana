package migrator

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	mssql "github.com/denisenkom/go-mssqldb"
	"github.com/golang-migrate/migrate/v4/database"
	"xorm.io/xorm"
)

type MsSQLDialect struct {
	BaseDialect
}

func NewMssqlDialect(engine *xorm.Engine) Dialect {
	d := MsSQLDialect{}
	d.BaseDialect.dialect = &d
	d.BaseDialect.engine = engine
	d.BaseDialect.driverName = MSSQL
	return &d
}

func (db *MsSQLDialect) SupportEngine() bool {
	return false
}

func (db *MsSQLDialect) Quote(name string) string {
	return "[" + name + "]"
}

func (db *MsSQLDialect) AutoIncrStr() string {
	return "IDENTITY(1,1)"
}

func (db *MsSQLDialect) BooleanStr(value bool) string {
	if value {
		return "1"
	}
	return "0"
}

func (db *MsSQLDialect) SQLType(c *Column) string {
	var res string

	switch c.Type {
	case DB_Bool:
		res = DB_Bit
	case DB_MediumInt, DB_Integer:
		res = DB_Int
		c.Length = 0
		c.Length2 = 0
	case DB_TinyText, DB_MediumText, DB_LongText, DB_Text:
		res = DB_Varchar + "(max)"
	case DB_Uuid:
		res = "uniqueidentifier"
	case DB_TimeStamp, DB_DateTime:
		if c.Length > 3 {
			res = "DATETIME2"
		} else {
			res = DB_DateTime
			c.Length = 0
		}
	case DB_TimeStampz:
		res = "DATETIMEOFFSET"
		c.Length = 7
	case DB_Double:
		res = DB_Float
	case DB_Blob, DB_TinyBlob, DB_MediumBlob, DB_LongBlob:
		res = DB_VarBinary
		if c.Length == 0 {
			res += "(MAX)"
		}
	case DB_Bytea, DB_VarBinary:
		res = DB_VarBinary
		if c.Length == 0 {
			c.Length = 50
		}
	case DB_Serial:
		c.IsAutoIncrement = true
		c.IsPrimaryKey = true
		c.Nullable = false
		res = DB_Int
	case DB_BigSerial:
		c.IsAutoIncrement = true
		c.IsPrimaryKey = true
		c.Nullable = false
		res = DB_BigInt
	default:
		res = c.Type
	}

	var hasLen1 = (c.Length > 0)
	var hasLen2 = (c.Length2 > 0)

	if hasLen2 {
		res += "(" + strconv.Itoa(c.Length) + "," + strconv.Itoa(c.Length2) + ")"
	} else if hasLen1 {
		res += "(" + strconv.Itoa(c.Length) + ")"
	}

	switch c.Type {
	case DB_Char, DB_TinyText, DB_Text, DB_MediumText, DB_LongText:
		res += " COLLATE Latin1_General_100_CI_AI"
	case DB_Varchar, DB_NVarchar:
		res += " COLLATE Latin1_General_100_CI_AI_SC"
	}

	return res
}

func (db *MsSQLDialect) CreateTableSQL(table *Table) string {
	sql := "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='"
	sql += table.Name + "' and xtype='U')" + "\n"
	sql += "CREATE TABLE " + db.dialect.Quote(table.Name) + " (\n  "

	pkList := table.PrimaryKeys

	for _, col := range table.Columns {
		if col.IsPrimaryKey && len(pkList) == 1 {
			sql += col.String(db.dialect)
		} else {
			sql += col.StringNoPk(db.dialect)
		}
		sql = strings.TrimSpace(sql)
		sql += "\n, "
	}

	if len(pkList) > 1 {
		quotedCols := []string{}
		for _, col := range pkList {
			quotedCols = append(quotedCols, db.dialect.Quote(col))
		}

		sql += "PRIMARY KEY ( " + strings.Join(quotedCols, ",") + " ), "
	}

	sql += ")\n;"
	return sql
}

func (db *MsSQLDialect) isThisError(err error, errcode int32) bool {
	var driverErr *mssql.Error
	if errors.As(err, &driverErr) {
		if driverErr.Number == errcode {
			return true
		}
	}

	return false
}

func (db *MsSQLDialect) ErrorMessage(err error) string {
	var driverErr *mssql.Error
	if errors.As(err, &driverErr) {
		return driverErr.Message
	}
	return ""
}

func (db *MsSQLDialect) IndexCheckSQL(tableName, indexName string) (string, []interface{}) {
	args := []interface{}{tableName, indexName}
	sql := "SELECT 1 FROM " + db.Quote("sys") + "." + db.Quote("indexes") + " WHERE " + db.Quote("object_id") + "=OBJECT_ID(?) AND " + db.Quote("name") + "=?"
	return sql, args
}
func (db *MsSQLDialect) ColumnCheckSQL(tableName, columnName string) (string, []interface{}) {
	args := []interface{}{tableName, columnName}
	sql := "SELECT 1 FROM " + db.Quote("INFORMATION_SCHEMA") + "." + db.Quote("COLUMNS") + " WHERE " + db.Quote("TABLE_NAME") + "=? AND " + db.Quote("COLUMN_NAME") + "=?"
	return sql, args
}

func (db *MsSQLDialect) IsDeadlock(err error) bool {
	return db.isThisError(err, 1205)
}

func (db *MsSQLDialect) IsUniqueConstraintViolation(err error) bool {
	return db.isThisError(err, 987)
}

func (db *MsSQLDialect) RenameTable(oldName string, newName string) string {
	return fmt.Sprintf("EXEC sp_rename '%s', '%s'", oldName, newName)
}

func (db *MsSQLDialect) RenameColumn(table Table, column *Column, newName string) string {
	return fmt.Sprintf("EXEC sp_rename '%s.%s', '%s', 'COLUMN'", table.Name, column.Name, newName)
}

func (db *MsSQLDialect) PreInsertId(table string, sess *xorm.Session) error {
	_, err := sess.Exec("SET IDENTITY_INSERT " + db.Quote(table) + " ON ")
	if err != nil {
		return fmt.Errorf("failed to set IDENTITY_INSERT: %w", err)
	}

	return nil
}

func (db *MsSQLDialect) PostInsertId(table string, sess *xorm.Session) error {
	_, err := sess.Exec("SET IDENTITY_INSERT " + db.Quote(table) + " OFF ")
	if err != nil {
		return fmt.Errorf("failed to unset IDENTITY_INSERT: %w", err)
	}

	return nil
}

func (db *MsSQLDialect) CopyTableData(sourceTable string, targetTable string, sourceCols []string, targetCols []string) string {
	sourceColsSQL := db.QuoteColList(sourceCols)
	targetColsSQL := db.QuoteColList(targetCols)

	sql := "IF EXISTS (\nSELECT * FROM " + db.Quote("sys") + "." + db.Quote("columns")
	sql += "\nWHERE IS_IDENTITY=1"
	sql += "\nAND Objectproperty(" + db.Quote("object_id") + ",'IsUserTable')=1"
	sql += "\nAND Object_Name(" + db.Quote("object_id") + ") = '" + targetTable + "'"
	sql += "\nAND " + db.Quote("name") + "IN ('" + strings.Join(targetCols, "','") + "'))\n"
	sql += "BEGIN\n"
	sql += "SET IDENTITY_INSERT " + db.Quote(targetTable) + " ON " + "\n"
	sql += "END\n"

	quote := db.Quote
	return sql + fmt.Sprintf("INSERT INTO %s (%s) SELECT %s FROM %s\nSET IDENTITY_INSERT %s OFF", quote(targetTable), targetColsSQL, sourceColsSQL, quote(sourceTable), quote(targetTable))
}

func (db *MsSQLDialect) AddColumnSQL(tableName string, col *Column) string {
	return fmt.Sprintf("ALTER TABLE %s ADD %s", db.Quote(tableName), col.StringNoPk(db.dialect))
}

func (db *MsSQLDialect) CreateIndexSQL(tableName string, index *Index) string {
	quote := db.Quote
	var unique string
	if index.Type == UniqueIndex {
		unique = " UNIQUE"
	}

	idxName := index.XName(tableName)

	quotedCols := []string{}
	quotedColsFilter := []string{}
	for _, col := range index.Cols {
		quotedCol := db.Quote(col)
		quotedCols = append(quotedCols, quotedCol)
		quotedColsFilter = append(quotedColsFilter, fmt.Sprintf("%s IS NOT NULL", quotedCol))
	}

	return fmt.Sprintf("CREATE%s INDEX %v ON %v (%v) WHERE %v;", unique, quote(idxName), quote(tableName), strings.Join(quotedCols, ","), strings.Join(quotedColsFilter, " AND "))
}

func (db *MsSQLDialect) CleanDB() error {
	sess := db.engine.NewSession()
	defer sess.Close()

	sess.Exec("EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';")
	sess.Exec("EXEC sp_MSforeachtable 'drop table ?';")

	return nil
}

func (db *MsSQLDialect) TruncateDBTables() error {
	sess := db.engine.NewSession()
	defer sess.Close()

	if _, err := sess.Exec("EXEC sp_MSforeachtable 'TRUNCATE TABLE ?', @whereand = ' AND o.Name <> ''migration_log'' AND o.Name <> ''dashboard_acl''';"); err != nil {
		return fmt.Errorf("failed to truncate tables: %w", err)
	}

	if _, err := sess.Exec("DELETE FROM [dashboard_acl] WHERE dashboard_id != -1 AND org_id != -1;"); err != nil {
		return fmt.Errorf("failed to truncate table dashboard_acl: %w", err)
	}
	if _, err := sess.Exec("DBCC CHECKIDENT (dashboard_acl, RESEED, 2);"); err != nil {
		return fmt.Errorf("failed to reset table dashboard_acl: %w", err)
	}

	return nil
}

//UpsertSQL returns empty string
func (db *MsSQLDialect) UpsertSQL(tableName string, keyCols, updateCols []string) string {
	sql := "MERGE INTO " + db.Quote(tableName) + " WITH (HOLDLOCK) AS target\n"
	sql += "USING (\n"

	matchKeyColsStr := strings.Builder{}
	columnsStr := strings.Builder{}
	updateColsStr := strings.Builder{}
	updateSetColsStr := strings.Builder{}
	sourceColsStr := strings.Builder{}

	newValuesStr := strings.Builder{}
	newValuesStr.WriteString("SELECT ")

	separator := ", "
	for i, c := range updateCols {
		if i == len(updateCols)-1 {
			separator = ""
		}

		newValuesStr.WriteString(fmt.Sprintf("? AS %s%s", db.Quote(c), separator))
		updateColsStr.WriteString(fmt.Sprintf("%s%s", db.Quote(c), separator))
		sourceColsStr.WriteString(fmt.Sprintf("source.%s%s", db.Quote(c), separator))
		updateSetColsStr.WriteString(fmt.Sprintf("target.%s = source.%s%s", db.Quote(c), db.Quote(c), separator))

		columnsStr.WriteString(fmt.Sprintf("%s%s", db.Quote(c), separator))
	}

	separator = " AND "
	for i, c := range keyCols {
		if i == len(keyCols)-1 {
			separator = ""
		}

		matchKeyColsStr.WriteString(fmt.Sprintf("target.%s = source.%s%s", db.Quote(c), db.Quote(c), separator))
	}

	sql += newValuesStr.String()
	sql += fmt.Sprintf(") AS source (%s)\n", columnsStr.String())
	sql += fmt.Sprintf("ON (%s)\n", matchKeyColsStr.String())
	sql += "WHEN MATCHED THEN\n"
	sql += fmt.Sprintf("UPDATE SET\n%s", updateSetColsStr.String())
	sql += "WHEN NOT MATCHED THEN\n"
	sql += fmt.Sprintf("INSERT (%s)\nVALUES\n(%s);", updateColsStr.String(), sourceColsStr.String())

	return sql
}

func (db *MsSQLDialect) Lock(cfg LockCfg) error {
	query := "EXEC sp_getapplock @Resource = ?, @LockMode = 'Exclusive', @LockTimeout = ?"
	var success int32

	lockName, err := db.getLockName()
	if err != nil {
		return fmt.Errorf("failed to generate lock name: %w", err)
	}

	_, err = cfg.Session.SQL(query, lockName, cfg.Timeout).Get(&success)
	if err != nil {
		return err
	}

	if success != 0 && success != 1 {
		return ErrLockDB
	}

	return nil
}

func (db *MsSQLDialect) Unlock(cfg LockCfg) error {
	query := "EXEC sp_releaseapplock @Resource = ?"
	var success int32

	lockName, err := db.getLockName()
	if err != nil {
		return fmt.Errorf("failed to generate lock name: %w", err)
	}

	_, err = cfg.Session.SQL(query, lockName).Get(&success)
	if err != nil {
		return err
	}

	if success != 0 {
		return ErrReleaseLockDB
	}

	return nil
}

func (db *MsSQLDialect) getLockName() (string, error) {
	dbName, err := db.getDBName()
	if err != nil {
		return "", err
	}
	key, err := database.GenerateAdvisoryLockId(dbName)
	if err != nil {
		return "", err
	}
	return key, nil
}

func (db *MsSQLDialect) getDBName() (string, error) {
	dsn := db.engine.DataSourceName()
	if strings.HasPrefix(dsn, "sqlserver://") {
		url, err := url.Parse(dsn)

		if err != nil {
			return "", err
		}

		return url.Query().Get("database"), nil
	}

	if strings.HasPrefix(dsn, "odbc:") {
		re := regexp.MustCompile(`(odbc:|;)database=((?P<empty>)|{(?P<databaseEscaped>(}}|.)*?)}{1}|(?P<database>[^{].*?))(;|$)`)

		result := make(map[string]string)
		match := re.FindStringSubmatch(dsn)

		if len(match) == 0 {
			return "", fmt.Errorf("failed to get database name")
		}

		for i, name := range re.SubexpNames() {
			if i != 0 && name != "" {
				result[name] = match[i]
			}
		}

		if database, contains := result["databaseEscaped"]; contains {
			return database, nil
		}

		if database, contains := result["database"]; contains {
			return database, nil
		}

		return "", fmt.Errorf("failed to get database name")
	}

	re := regexp.MustCompile(`(^|;)database=(?P<database>.*?)(;|$)`)
	result := make(map[string]string)
	match := re.FindStringSubmatch(dsn)

	if len(match) == 0 {
		return "", fmt.Errorf("failed to get database name")
	}

	for i, name := range re.SubexpNames() {
		if i != 0 && name != "" {
			result[name] = match[i]
		}
	}

	if database, contains := result["database"]; contains {
		return database, nil
	}

	return "", fmt.Errorf("failed to get database name")
}

func (db *MsSQLDialect) Limit(limit int64) string {
	return fmt.Sprintf(" OFFSET 0 ROW FETCH NEXT %d ROW ONLY", limit)
}

func (db *MsSQLDialect) LimitOffset(limit int64, offset int64) string {
	return fmt.Sprintf(" OFFSET %d ROW FETCH NEXT %d ROW ONLY", offset, limit)
}
