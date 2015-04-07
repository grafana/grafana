package xorm

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"hash/crc32"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/go-xorm/core"
)

// Struct Session keep a pointer to sql.DB and provides all execution of all
// kind of database operations.
type Session struct {
	db                     *core.DB
	Engine                 *Engine
	Tx                     *core.Tx
	Statement              Statement
	IsAutoCommit           bool
	IsCommitedOrRollbacked bool
	TransType              string
	IsAutoClose            bool

	// Automatically reset the statement after operations that execute a SQL
	// query such as Count(), Find(), Get(), ...
	AutoResetStatement bool

	// !nashtsai! storing these beans due to yet committed tx
	afterInsertBeans map[interface{}]*[]func(interface{})
	afterUpdateBeans map[interface{}]*[]func(interface{})
	afterDeleteBeans map[interface{}]*[]func(interface{})
	// --

	beforeClosures []func(interface{})
	afterClosures  []func(interface{})

	stmtCache   map[uint32]*core.Stmt //key: hash.Hash32 of (queryStr, len(queryStr))
	cascadeDeep int
}

// Method Init reset the session as the init status.
func (session *Session) Init() {
	session.Statement = Statement{Engine: session.Engine}
	session.Statement.Init()
	session.IsAutoCommit = true
	session.IsCommitedOrRollbacked = false
	session.IsAutoClose = false
	session.AutoResetStatement = true

	// !nashtsai! is lazy init better?
	session.afterInsertBeans = make(map[interface{}]*[]func(interface{}), 0)
	session.afterUpdateBeans = make(map[interface{}]*[]func(interface{}), 0)
	session.afterDeleteBeans = make(map[interface{}]*[]func(interface{}), 0)
	session.beforeClosures = make([]func(interface{}), 0)
	session.afterClosures = make([]func(interface{}), 0)
}

// Method Close release the connection from pool
func (session *Session) Close() {
	for _, v := range session.stmtCache {
		v.Close()
	}

	if session.db != nil {
		//session.Engine.Pool.ReleaseDB(session.Engine, session.Db)
		session.db = nil
		session.Tx = nil
		session.stmtCache = nil
		session.Init()
	}
}

func (session *Session) resetStatement() {
	if session.AutoResetStatement {
		session.Statement.Init()
	}
}

// Method Sql provides raw sql input parameter. When you have a complex SQL statement
// and cannot use Where, Id, In and etc. Methods to describe, you can use Sql.
func (session *Session) Sql(querystring string, args ...interface{}) *Session {
	session.Statement.Sql(querystring, args...)
	return session
}

// Method Where provides custom query condition.
func (session *Session) Where(querystring string, args ...interface{}) *Session {
	session.Statement.Where(querystring, args...)
	return session
}

// Method Where provides custom query condition.
func (session *Session) And(querystring string, args ...interface{}) *Session {
	session.Statement.And(querystring, args...)
	return session
}

// Method Where provides custom query condition.
func (session *Session) Or(querystring string, args ...interface{}) *Session {
	session.Statement.Or(querystring, args...)
	return session
}

// Method Id provides converting id as a query condition
func (session *Session) Id(id interface{}) *Session {
	session.Statement.Id(id)
	return session
}

// Apply before Processor, affected bean is passed to closure arg
func (session *Session) Before(closures func(interface{})) *Session {
	if closures != nil {
		session.beforeClosures = append(session.beforeClosures, closures)
	}
	return session
}

// Apply after Processor, affected bean is passed to closure arg
func (session *Session) After(closures func(interface{})) *Session {
	if closures != nil {
		session.afterClosures = append(session.afterClosures, closures)
	}
	return session
}

// Method core.Table can input a string or pointer to struct for special a table to operate.
func (session *Session) Table(tableNameOrBean interface{}) *Session {
	session.Statement.Table(tableNameOrBean)
	return session
}

// set the table alias
func (session *Session) Alias(alias string) *Session {
	session.Statement.Alias(alias)
	return session
}

// Method In provides a query string like "id in (1, 2, 3)"
func (session *Session) In(column string, args ...interface{}) *Session {
	session.Statement.In(column, args...)
	return session
}

// Method In provides a query string like "count = count + 1"
func (session *Session) Incr(column string, arg ...interface{}) *Session {
	session.Statement.Incr(column, arg...)
	return session
}

// Method Decr provides a query string like "count = count - 1"
func (session *Session) Decr(column string, arg ...interface{}) *Session {
	session.Statement.Decr(column, arg...)
	return session
}

// Method SetExpr provides a query string like "column = {expression}"
func (session *Session) SetExpr(column string, expression string) *Session {
	session.Statement.SetExpr(column, expression)
	return session
}

// Method Cols provides some columns to special
func (session *Session) Cols(columns ...string) *Session {
	session.Statement.Cols(columns...)
	return session
}

func (session *Session) AllCols() *Session {
	session.Statement.AllCols()
	return session
}

func (session *Session) MustCols(columns ...string) *Session {
	session.Statement.MustCols(columns...)
	return session
}

func (session *Session) NoCascade() *Session {
	session.Statement.UseCascade = false
	return session
}

// Xorm automatically retrieve condition according struct, but
// if struct has bool field, it will ignore them. So use UseBool
// to tell system to do not ignore them.
// If no paramters, it will use all the bool field of struct, or
// it will use paramters's columns
func (session *Session) UseBool(columns ...string) *Session {
	session.Statement.UseBool(columns...)
	return session
}

// use for distinct columns. Caution: when you are using cache,
// distinct will not be cached because cache system need id,
// but distinct will not provide id
func (session *Session) Distinct(columns ...string) *Session {
	session.Statement.Distinct(columns...)
	return session
}

// Only not use the paramters as select or update columns
func (session *Session) Omit(columns ...string) *Session {
	session.Statement.Omit(columns...)
	return session
}

// Method NoAutoTime means do not automatically give created field and updated field
// the current time on the current session temporarily
func (session *Session) NoAutoTime() *Session {
	session.Statement.UseAutoTime = false
	return session
}

// Method Limit provide limit and offset query condition
func (session *Session) Limit(limit int, start ...int) *Session {
	session.Statement.Limit(limit, start...)
	return session
}

// Method OrderBy provide order by query condition, the input parameter is the content
// after order by on a sql statement.
func (session *Session) OrderBy(order string) *Session {
	session.Statement.OrderBy(order)
	return session
}

// Method Desc provide desc order by query condition, the input parameters are columns.
func (session *Session) Desc(colNames ...string) *Session {
	session.Statement.Desc(colNames...)
	return session
}

// Method Asc provide asc order by query condition, the input parameters are columns.
func (session *Session) Asc(colNames ...string) *Session {
	session.Statement.Asc(colNames...)
	return session
}

// Method StoreEngine is only avialble mysql dialect currently
func (session *Session) StoreEngine(storeEngine string) *Session {
	session.Statement.StoreEngine = storeEngine
	return session
}

// Method Charset is only avialble mysql dialect currently
func (session *Session) Charset(charset string) *Session {
	session.Statement.Charset = charset
	return session
}

// Method Cascade indicates if loading sub Struct
func (session *Session) Cascade(trueOrFalse ...bool) *Session {
	if len(trueOrFalse) >= 1 {
		session.Statement.UseCascade = trueOrFalse[0]
	}
	return session
}

// Method NoCache ask this session do not retrieve data from cache system and
// get data from database directly.
func (session *Session) NoCache() *Session {
	session.Statement.UseCache = false
	return session
}

//The join_operator should be one of INNER, LEFT OUTER, CROSS etc - this will be prepended to JOIN
func (session *Session) Join(join_operator string, tablename interface{}, condition string) *Session {
	session.Statement.Join(join_operator, tablename, condition)
	return session
}

// Generate Group By statement
func (session *Session) GroupBy(keys string) *Session {
	session.Statement.GroupBy(keys)
	return session
}

// Generate Having statement
func (session *Session) Having(conditions string) *Session {
	session.Statement.Having(conditions)
	return session
}

func (session *Session) DB() *core.DB {
	if session.db == nil {
		session.db = session.Engine.db
		session.stmtCache = make(map[uint32]*core.Stmt, 0)
	}
	return session.db
}

// Begin a transaction
func (session *Session) Begin() error {
	if session.IsAutoCommit {
		tx, err := session.DB().Begin()
		if err != nil {
			return err
		}
		session.IsAutoCommit = false
		session.IsCommitedOrRollbacked = false
		session.Tx = tx

		session.Engine.logSQL("BEGIN TRANSACTION")
	}
	return nil
}

// When using transaction, you can rollback if any error
func (session *Session) Rollback() error {
	if !session.IsAutoCommit && !session.IsCommitedOrRollbacked {
		session.Engine.logSQL(session.Engine.dialect.RollBackStr())
		session.IsCommitedOrRollbacked = true
		return session.Tx.Rollback()
	}
	return nil
}

// When using transaction, Commit will commit all operations.
func (session *Session) Commit() error {
	if !session.IsAutoCommit && !session.IsCommitedOrRollbacked {
		session.Engine.logSQL("COMMIT")
		session.IsCommitedOrRollbacked = true
		var err error
		if err = session.Tx.Commit(); err == nil {
			// handle processors after tx committed

			closureCallFunc := func(closuresPtr *[]func(interface{}), bean interface{}) {

				if closuresPtr != nil {
					for _, closure := range *closuresPtr {
						closure(bean)
					}
				}
			}

			for bean, closuresPtr := range session.afterInsertBeans {
				closureCallFunc(closuresPtr, bean)

				if processor, ok := interface{}(bean).(AfterInsertProcessor); ok {
					processor.AfterInsert()
				}
			}
			for bean, closuresPtr := range session.afterUpdateBeans {
				closureCallFunc(closuresPtr, bean)

				if processor, ok := interface{}(bean).(AfterUpdateProcessor); ok {
					processor.AfterUpdate()
				}
			}
			for bean, closuresPtr := range session.afterDeleteBeans {
				closureCallFunc(closuresPtr, bean)

				if processor, ok := interface{}(bean).(AfterDeleteProcessor); ok {
					processor.AfterDelete()
				}
			}
			cleanUpFunc := func(slices *map[interface{}]*[]func(interface{})) {
				if len(*slices) > 0 {
					*slices = make(map[interface{}]*[]func(interface{}), 0)
				}
			}
			cleanUpFunc(&session.afterInsertBeans)
			cleanUpFunc(&session.afterUpdateBeans)
			cleanUpFunc(&session.afterDeleteBeans)
		}
		return err
	}
	return nil
}

func cleanupProcessorsClosures(slices *[]func(interface{})) {
	if len(*slices) > 0 {
		*slices = make([]func(interface{}), 0)
	}
}

func (session *Session) scanMapIntoStruct(obj interface{}, objMap map[string][]byte) error {
	dataStruct := rValue(obj)
	if dataStruct.Kind() != reflect.Struct {
		return errors.New("Expected a pointer to a struct")
	}

	var col *core.Column
	table := session.Engine.autoMapType(dataStruct)

	for key, data := range objMap {
		if col = table.GetColumn(key); col == nil {
			session.Engine.LogWarn(fmt.Sprintf("struct %v's has not field %v. %v",
				table.Type.Name(), key, table.ColumnsSeq()))
			continue
		}

		fieldName := col.FieldName
		fieldPath := strings.Split(fieldName, ".")
		var fieldValue reflect.Value
		if len(fieldPath) > 2 {
			session.Engine.LogError("Unsupported mutliderive", fieldName)
			continue
		} else if len(fieldPath) == 2 {
			parentField := dataStruct.FieldByName(fieldPath[0])
			if parentField.IsValid() {
				fieldValue = parentField.FieldByName(fieldPath[1])
			}
		} else {
			fieldValue = dataStruct.FieldByName(fieldName)
		}
		if !fieldValue.IsValid() || !fieldValue.CanSet() {
			session.Engine.LogWarn("table %v's column %v is not valid or cannot set",
				table.Name, key)
			continue
		}

		err := session.bytes2Value(col, &fieldValue, data)
		if err != nil {
			return err
		}
	}

	return nil
}

//Execute sql
func (session *Session) innerExec(sqlStr string, args ...interface{}) (sql.Result, error) {
	stmt, err := session.doPrepare(sqlStr)
	if err != nil {
		return nil, err
	}
	//defer stmt.Close()

	res, err := stmt.Exec(args...)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (session *Session) exec(sqlStr string, args ...interface{}) (sql.Result, error) {
	for _, filter := range session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}

	session.Engine.logSQL(sqlStr, args...)

	return session.Engine.LogSQLExecutionTime(sqlStr, args, func() (sql.Result, error) {
		if session.IsAutoCommit {
			//oci8 can not auto commit (github.com/mattn/go-oci8)
			if session.Engine.dialect.DBType() == core.ORACLE {
				session.Begin()
				r, err := session.Tx.Exec(sqlStr, args...)
				session.Commit()
				return r, err
			}
			return session.innerExec(sqlStr, args...)
		}
		return session.Tx.Exec(sqlStr, args...)
	})
}

// Exec raw sql
func (session *Session) Exec(sqlStr string, args ...interface{}) (sql.Result, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.exec(sqlStr, args...)
}

// this function create a table according a bean
func (session *Session) CreateTable(bean interface{}) error {
	session.Statement.RefTable = session.Engine.TableInfo(bean)

	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.createOneTable()
}

// create indexes
func (session *Session) CreateIndexes(bean interface{}) error {
	session.Statement.RefTable = session.Engine.TableInfo(bean)

	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	sqls := session.Statement.genIndexSQL()
	for _, sqlStr := range sqls {
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

// create uniques
func (session *Session) CreateUniques(bean interface{}) error {
	session.Statement.RefTable = session.Engine.TableInfo(bean)

	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	sqls := session.Statement.genUniqueSQL()
	for _, sqlStr := range sqls {
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

func (session *Session) createOneTable() error {
	sqlStr := session.Statement.genCreateTableSQL()
	session.Engine.LogDebug("create table sql: [", sqlStr, "]")
	_, err := session.exec(sqlStr)
	return err
}

// to be deleted
func (session *Session) createAll() error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	for _, table := range session.Engine.Tables {
		session.Statement.RefTable = table
		err := session.createOneTable()
		if err != nil {
			return err
		}
	}
	return nil
}

// drop indexes
func (session *Session) DropIndexes(bean interface{}) error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	sqls := session.Statement.genDelIndexSQL()
	for _, sqlStr := range sqls {
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

// drop table will drop table if exist, if drop failed, it will return error
func (session *Session) DropTable(beanOrTableName interface{}) error {
	tableName, err := session.Engine.tableName(beanOrTableName)
	if err != nil {
		return err
	}

	var needDrop = true
	if !session.Engine.dialect.SupportDropIfExists() {
		sqlStr, args := session.Engine.dialect.TableCheckSql(tableName)
		results, err := session.query(sqlStr, args...)
		if err != nil {
			return err
		}
		needDrop = len(results) > 0
	}

	if needDrop {
		sqlStr := session.Engine.Dialect().DropTableSql(tableName)
		_, err = session.exec(sqlStr)
		return err
	}
	return nil
}

func (statement *Statement) JoinColumns(cols []*core.Column) string {
	var colnames = make([]string, len(cols))
	for i, col := range cols {
		colnames[i] = statement.Engine.Quote(statement.TableName()) +
			"." + statement.Engine.Quote(col.Name)
	}
	return strings.Join(colnames, ", ")
}

func (statement *Statement) convertIdSql(sqlStr string) string {
	if statement.RefTable != nil {
		cols := statement.RefTable.PKColumns()
		if len(cols) == 0 {
			return ""
		}

		colstrs := statement.JoinColumns(cols)
		sqls := splitNNoCase(sqlStr, "from", 2)
		if len(sqls) != 2 {
			return ""
		}
		return fmt.Sprintf("SELECT %s FROM %v", colstrs, sqls[1])
	}
	return ""
}

func (session *Session) cacheGet(bean interface{}, sqlStr string, args ...interface{}) (has bool, err error) {
	// if has no reftable, then don't use cache currently
	if session.Statement.RefTable == nil ||
		session.Statement.JoinStr != "" ||
		session.Statement.RawSQL != "" {
		return false, ErrCacheFailed
	}

	for _, filter := range session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}
	newsql := session.Statement.convertIdSql(sqlStr)
	if newsql == "" {
		return false, ErrCacheFailed
	}

	cacher := session.Engine.getCacher2(session.Statement.RefTable)
	tableName := session.Statement.TableName()
	session.Engine.LogDebug("[cacheGet] find sql:", newsql, args)
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args)
	table := session.Statement.RefTable
	if err != nil {
		var res = make([]string, len(table.PrimaryKeys))
		rows, err := session.DB().Query(newsql, args...)
		if err != nil {
			return false, err
		}
		defer rows.Close()

		if rows.Next() {
			err = rows.ScanSlice(&res)
			if err != nil {
				return false, err
			}
		} else {
			return false, ErrCacheFailed
		}

		var pk core.PK = make([]interface{}, len(table.PrimaryKeys))
		for i, col := range table.PKColumns() {
			if col.SQLType.IsText() {
				pk[i] = res[i]
			} else if col.SQLType.IsNumeric() {
				n, err := strconv.ParseInt(res[i], 10, 64)
				if err != nil {
					return false, err
				}
				pk[i] = n
			} else {
				return false, errors.New("unsupported")
			}
		}

		ids = []core.PK{pk}
		session.Engine.LogDebug("[cacheGet] cache ids:", newsql, ids)
		err = core.PutCacheSql(cacher, ids, tableName, newsql, args)
		if err != nil {
			return false, err
		}
	} else {
		session.Engine.LogDebug("[cacheGet] cache hit sql:", newsql)
	}

	if len(ids) > 0 {
		structValue := reflect.Indirect(reflect.ValueOf(bean))
		id := ids[0]
		session.Engine.LogDebug("[cacheGet] get bean:", tableName, id)
		sid, err := id.ToString()
		if err != nil {
			return false, err
		}
		cacheBean := cacher.GetBean(tableName, sid)
		if cacheBean == nil {
			newSession := session.Engine.NewSession()
			defer newSession.Close()
			cacheBean = reflect.New(structValue.Type()).Interface()
			newSession.Id(id).NoCache()
			if session.Statement.AltTableName != "" {
				newSession.Table(session.Statement.AltTableName)
			}
			if !session.Statement.UseCascade {
				newSession.NoCascade()
			}
			has, err = newSession.Get(cacheBean)
			if err != nil || !has {
				return has, err
			}

			session.Engine.LogDebug("[cacheGet] cache bean:", tableName, id, cacheBean)
			cacher.PutBean(tableName, sid, cacheBean)
		} else {
			session.Engine.LogDebug("[cacheGet] cache hit bean:", tableName, id, cacheBean)
			has = true
		}
		structValue.Set(reflect.Indirect(reflect.ValueOf(cacheBean)))

		return has, nil
	}
	return false, nil
}

func (session *Session) cacheFind(t reflect.Type, sqlStr string, rowsSlicePtr interface{}, args ...interface{}) (err error) {
	if session.Statement.RefTable == nil ||
		indexNoCase(sqlStr, "having") != -1 ||
		indexNoCase(sqlStr, "group by") != -1 {
		return ErrCacheFailed
	}

	for _, filter := range session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}

	newsql := session.Statement.convertIdSql(sqlStr)
	if newsql == "" {
		return ErrCacheFailed
	}

	table := session.Statement.RefTable
	cacher := session.Engine.getCacher2(table)
	ids, err := core.GetCacheSql(cacher, session.Statement.TableName(), newsql, args)
	if err != nil {
		rows, err := session.DB().Query(newsql, args...)
		if err != nil {
			return err
		}
		defer rows.Close()

		var i int
		ids = make([]core.PK, 0)
		for rows.Next() {
			i++
			if i > 500 {
				session.Engine.LogDebug("[cacheFind] ids length > 500, no cache")
				return ErrCacheFailed
			}
			var res = make([]string, len(table.PrimaryKeys))
			err = rows.ScanSlice(&res)
			if err != nil {
				return err
			}

			var pk core.PK = make([]interface{}, len(table.PrimaryKeys))
			for i, col := range table.PKColumns() {
				if col.SQLType.IsNumeric() {
					n, err := strconv.ParseInt(res[i], 10, 64)
					if err != nil {
						return err
					}
					pk[i] = n
				} else if col.SQLType.IsText() {
					pk[i] = res[i]
				} else {
					return errors.New("not supported")
				}
			}

			ids = append(ids, pk)
		}

		tableName := session.Statement.TableName()

		session.Engine.LogDebug("[cacheFind] cache sql:", ids, tableName, newsql, args)
		err = core.PutCacheSql(cacher, ids, tableName, newsql, args)
		if err != nil {
			return err
		}
	} else {
		session.Engine.LogDebug("[cacheFind] cache hit sql:", newsql, args)
	}

	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))

	ididxes := make(map[string]int)
	var ides []core.PK = make([]core.PK, 0)
	var temps []interface{} = make([]interface{}, len(ids))
	tableName := session.Statement.TableName()
	for idx, id := range ids {
		sid, err := id.ToString()
		if err != nil {
			return err
		}
		bean := cacher.GetBean(tableName, sid)
		if bean == nil {
			ides = append(ides, id)
			ididxes[sid] = idx
		} else {
			session.Engine.LogDebug("[cacheFind] cache hit bean:", tableName, id, bean)

			pk := session.Engine.IdOf(bean)
			xid, err := pk.ToString()
			if err != nil {
				return err
			}

			if sid != xid {
				session.Engine.LogError("[cacheFind] error cache", xid, sid, bean)
				return ErrCacheFailed
			}
			temps[idx] = bean
		}
	}

	if len(ides) > 0 {
		newSession := session.Engine.NewSession()
		defer newSession.Close()

		slices := reflect.New(reflect.SliceOf(t))
		beans := slices.Interface()

		if len(table.PrimaryKeys) == 1 {
			ff := make([]interface{}, 0)
			for _, ie := range ides {
				ff = append(ff, ie[0])
			}

			newSession.In(table.PrimaryKeys[0], ff...)
		} else {
			var kn = make([]string, 0)
			for _, name := range table.PrimaryKeys {
				kn = append(kn, name+" = ?")
			}
			condi := "(" + strings.Join(kn, " AND ") + ")"
			for _, ie := range ides {
				newSession.Or(condi, ie...)
			}
		}

		err = newSession.NoCache().Find(beans)
		if err != nil {
			return err
		}

		vs := reflect.Indirect(reflect.ValueOf(beans))
		for i := 0; i < vs.Len(); i++ {
			rv := vs.Index(i)
			if rv.Kind() != reflect.Ptr {
				rv = rv.Addr()
			}
			bean := rv.Interface()
			id := session.Engine.IdOf(bean)
			sid, err := id.ToString()
			if err != nil {
				return err
			}

			temps[ididxes[sid]] = bean
			session.Engine.LogDebug("[cacheFind] cache bean:", tableName, id, bean)
			cacher.PutBean(tableName, sid, bean)
		}
	}

	for j := 0; j < len(temps); j++ {
		bean := temps[j]
		if bean == nil {
			session.Engine.LogWarn("[cacheFind] cache no hit:", tableName, ides[j])
			// return errors.New("cache error") // !nashtsai! no need to return error, but continue instead
			continue
		}
		if sliceValue.Kind() == reflect.Slice {
			if t.Kind() == reflect.Ptr {
				sliceValue.Set(reflect.Append(sliceValue, reflect.ValueOf(bean)))
			} else {
				sliceValue.Set(reflect.Append(sliceValue, reflect.Indirect(reflect.ValueOf(bean))))
			}
		} else if sliceValue.Kind() == reflect.Map {
			var key core.PK = ids[j]
			keyType := sliceValue.Type().Key()
			var ikey interface{}
			if len(key) == 1 {
				ikey, err = Atot(fmt.Sprintf("%v", key[0]), keyType)
				if err != nil {
					return err
				}
			} else {
				if keyType.Kind() != reflect.Slice {
					return errors.New("table have multiple primary keys, key is not core.PK or slice")
				}
				ikey = key
			}

			if t.Kind() == reflect.Ptr {
				sliceValue.SetMapIndex(reflect.ValueOf(ikey), reflect.ValueOf(bean))
			} else {
				sliceValue.SetMapIndex(reflect.ValueOf(ikey), reflect.Indirect(reflect.ValueOf(bean)))
			}
		}
	}

	return nil
}

// IterFunc only use by Iterate
type IterFunc func(idx int, bean interface{}) error

// Return sql.Rows compatible Rows obj, as a forward Iterator object for iterating record by record, bean's non-empty fields
// are conditions.
func (session *Session) Rows(bean interface{}) (*Rows, error) {
	return newRows(session, bean)
}

// Iterate record by record handle records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (session *Session) Iterate(bean interface{}, fun IterFunc) error {
	rows, err := session.Rows(bean)
	if err != nil {
		return err
	}
	defer rows.Close()
	//b := reflect.New(iterator.beanType).Interface()
	i := 0
	for rows.Next() {
		b := reflect.New(rows.beanType).Interface()
		err = rows.Scan(b)
		if err != nil {
			return err
		}
		err = fun(i, b)
		if err != nil {
			return err
		}
		i++
	}
	return err
}

func (session *Session) doPrepare(sqlStr string) (stmt *core.Stmt, err error) {
	crc := crc32.ChecksumIEEE([]byte(sqlStr))
	// TODO try hash(sqlStr+len(sqlStr))
	var has bool
	stmt, has = session.stmtCache[crc]
	if !has {
		stmt, err = session.DB().Prepare(sqlStr)
		if err != nil {
			return nil, err
		}
		session.stmtCache[crc] = stmt
	}
	return
}

// get retrieve one record from database, bean's non-empty fields
// will be as conditions
func (session *Session) Get(bean interface{}) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	session.Statement.Limit(1)
	var sqlStr string
	var args []interface{}

	if session.Statement.RefTable == nil {
		session.Statement.RefTable = session.Engine.TableInfo(bean)
	}

	if session.Statement.RawSQL == "" {
		sqlStr, args = session.Statement.genGetSql(bean)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	if session.Statement.JoinStr == "" {
		if cacher := session.Engine.getCacher2(session.Statement.RefTable); cacher != nil &&
			session.Statement.UseCache &&
			!session.Statement.unscoped {
			has, err := session.cacheGet(bean, sqlStr, args...)
			if err != ErrCacheFailed {
				return has, err
			}
		}
	}

	var rawRows *core.Rows
	var err error
	session.queryPreprocess(&sqlStr, args...)
	if session.IsAutoCommit {
		stmt, err := session.doPrepare(sqlStr)
		if err != nil {
			return false, err
		}
		// defer stmt.Close() // !nashtsai! don't close due to stmt is cached and bounded to this session
		rawRows, err = stmt.Query(args...)
	} else {
		rawRows, err = session.Tx.Query(sqlStr, args...)
	}
	if err != nil {
		return false, err
	}

	defer rawRows.Close()

	if rawRows.Next() {
		if fields, err := rawRows.Columns(); err == nil {
			err = session.row2Bean(rawRows, fields, len(fields), bean)
		}
		return true, err
	}
	return false, nil
}

// Count counts the records. bean's non-empty fields
// are conditions.
func (session *Session) Count(bean interface{}) (int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	var sqlStr string
	var args []interface{}
	if session.Statement.RawSQL == "" {
		sqlStr, args = session.Statement.genCountSql(bean)
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	resultsSlice, err := session.query(sqlStr, args...)
	if err != nil {
		return 0, err
	}

	var total int64 = 0
	if len(resultsSlice) > 0 {
		results := resultsSlice[0]
		for _, value := range results {
			total, err = strconv.ParseInt(string(value), 10, 64)
			break
		}
	}

	return int64(total), err
}

func Atot(s string, tp reflect.Type) (interface{}, error) {
	var err error
	var result interface{}
	switch tp.Kind() {
	case reflect.Int:
		result, err = strconv.Atoi(s)
		if err != nil {
			return nil, errors.New("convert " + s + " as int: " + err.Error())
		}
	case reflect.Int8:
		x, err := strconv.Atoi(s)
		if err != nil {
			return nil, errors.New("convert " + s + " as int16: " + err.Error())
		}
		result = int8(x)
	case reflect.Int16:
		x, err := strconv.Atoi(s)
		if err != nil {
			return nil, errors.New("convert " + s + " as int16: " + err.Error())
		}
		result = int16(x)
	case reflect.Int32:
		x, err := strconv.Atoi(s)
		if err != nil {
			return nil, errors.New("convert " + s + " as int32: " + err.Error())
		}
		result = int32(x)
	case reflect.Int64:
		result, err = strconv.ParseInt(s, 10, 64)
		if err != nil {
			return nil, errors.New("convert " + s + " as int64: " + err.Error())
		}
	case reflect.Uint:
		x, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return nil, errors.New("convert " + s + " as uint: " + err.Error())
		}
		result = uint(x)
	case reflect.Uint8:
		x, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return nil, errors.New("convert " + s + " as uint8: " + err.Error())
		}
		result = uint8(x)
	case reflect.Uint16:
		x, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return nil, errors.New("convert " + s + " as uint16: " + err.Error())
		}
		result = uint16(x)
	case reflect.Uint32:
		x, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return nil, errors.New("convert " + s + " as uint32: " + err.Error())
		}
		result = uint32(x)
	case reflect.Uint64:
		result, err = strconv.ParseUint(s, 10, 64)
		if err != nil {
			return nil, errors.New("convert " + s + " as uint64: " + err.Error())
		}
	case reflect.String:
		result = s
	default:
		panic("unsupported convert type")
	}
	return result, nil
}

// Find retrieve records from table, condiBeans's non-empty fields
// are conditions. beans could be []Struct, []*Struct, map[int64]Struct
// map[int64]*Struct
func (session *Session) Find(rowsSlicePtr interface{}, condiBean ...interface{}) error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() != reflect.Slice && sliceValue.Kind() != reflect.Map {
		return errors.New("needs a pointer to a slice or a map")
	}

	sliceElementType := sliceValue.Type().Elem()
	var table *core.Table
	if session.Statement.RefTable == nil {
		if sliceElementType.Kind() == reflect.Ptr {
			if sliceElementType.Elem().Kind() == reflect.Struct {
				pv := reflect.New(sliceElementType.Elem())
				table = session.Engine.autoMapType(pv.Elem())
			} else {
				return errors.New("slice type")
			}
		} else if sliceElementType.Kind() == reflect.Struct {
			pv := reflect.New(sliceElementType)
			table = session.Engine.autoMapType(pv.Elem())
		} else {
			return errors.New("slice type")
		}
		session.Statement.RefTable = table
	} else {
		table = session.Statement.RefTable
	}

	if len(condiBean) > 0 {
		colNames, args := buildConditions(session.Engine, table, condiBean[0], true, true,
			false, true, session.Statement.allUseBool, session.Statement.useAllCols,
			session.Statement.unscoped, session.Statement.mustColumnMap)
		session.Statement.ConditionStr = strings.Join(colNames, " AND ")
		session.Statement.BeanArgs = args
	} else {
		// !oinume! Add "<col> IS NULL" to WHERE whatever condiBean is given.
		// See https://github.com/go-xorm/xorm/issues/179
		if col := table.DeletedColumn(); col != nil && !session.Statement.unscoped { // tag "deleted" is enabled
			session.Statement.ConditionStr = fmt.Sprintf("(%v IS NULL or %v = '0001-01-01 00:00:00') ",
				session.Engine.Quote(col.Name), session.Engine.Quote(col.Name))
		}
	}

	var sqlStr string
	var args []interface{}
	if session.Statement.RawSQL == "" {
		var columnStr string = session.Statement.ColumnStr
		if session.Statement.JoinStr == "" {
			if columnStr == "" {
				if session.Statement.GroupByStr != "" {
					columnStr = session.Statement.Engine.Quote(strings.Replace(session.Statement.GroupByStr, ",", session.Engine.Quote(","), -1))
				} else {
					columnStr = session.Statement.genColumnStr()
				}
			}
		} else {
			if columnStr == "" {
				if session.Statement.GroupByStr != "" {
					columnStr = session.Statement.Engine.Quote(strings.Replace(session.Statement.GroupByStr, ",", session.Engine.Quote(","), -1))
				} else {
					columnStr = "*"
				}
			}
		}

		session.Statement.attachInSql()

		sqlStr = session.Statement.genSelectSql(columnStr)
		args = append(session.Statement.Params, session.Statement.BeanArgs...)
		// for mssql and use limit
		qs := strings.Count(sqlStr, "?")
		if len(args)*2 == qs {
			args = append(args, args...)
		}
	} else {
		sqlStr = session.Statement.RawSQL
		args = session.Statement.RawParams
	}

	var err error
	if session.Statement.JoinStr == "" {
		if cacher := session.Engine.getCacher2(table); cacher != nil &&
			session.Statement.UseCache &&
			!session.Statement.IsDistinct &&
			!session.Statement.unscoped {
			err = session.cacheFind(sliceElementType, sqlStr, rowsSlicePtr, args...)
			if err != ErrCacheFailed {
				return err
			}
			err = nil // !nashtsai! reset err to nil for ErrCacheFailed
			session.Engine.LogWarn("Cache Find Failed")
		}
	}

	if sliceValue.Kind() != reflect.Map {
		var rawRows *core.Rows
		var stmt *core.Stmt

		session.queryPreprocess(&sqlStr, args...)

		if session.IsAutoCommit {
			stmt, err = session.doPrepare(sqlStr)
			if err != nil {
				return err
			}
			rawRows, err = stmt.Query(args...)
		} else {
			rawRows, err = session.Tx.Query(sqlStr, args...)
		}
		if err != nil {
			return err
		}
		defer rawRows.Close()

		fields, err := rawRows.Columns()
		if err != nil {
			return err
		}

		fieldsCount := len(fields)

		var newElemFunc func() reflect.Value
		if sliceElementType.Kind() == reflect.Ptr {
			newElemFunc = func() reflect.Value {
				return reflect.New(sliceElementType.Elem())
			}
		} else {
			newElemFunc = func() reflect.Value {
				return reflect.New(sliceElementType)
			}
		}

		var sliceValueSetFunc func(*reflect.Value)

		if sliceValue.Kind() == reflect.Slice {
			if sliceElementType.Kind() == reflect.Ptr {
				sliceValueSetFunc = func(newValue *reflect.Value) {
					sliceValue.Set(reflect.Append(sliceValue, reflect.ValueOf(newValue.Interface())))
				}
			} else {
				sliceValueSetFunc = func(newValue *reflect.Value) {
					sliceValue.Set(reflect.Append(sliceValue, reflect.Indirect(reflect.ValueOf(newValue.Interface()))))
				}
			}
		}

		var newValue reflect.Value = newElemFunc()
		dataStruct := rValue(newValue.Interface())
		if dataStruct.Kind() != reflect.Struct {
			return errors.New("Expected a pointer to a struct")
		}

		table := session.Engine.autoMapType(dataStruct)

		return session.rows2Beans(rawRows, fields, fieldsCount, table, newElemFunc, sliceValueSetFunc)
	} else {
		resultsSlice, err := session.query(sqlStr, args...)
		if err != nil {
			return err
		}

		keyType := sliceValue.Type().Key()

		for _, results := range resultsSlice {
			var newValue reflect.Value
			if sliceElementType.Kind() == reflect.Ptr {
				newValue = reflect.New(sliceElementType.Elem())
			} else {
				newValue = reflect.New(sliceElementType)
			}
			err := session.scanMapIntoStruct(newValue.Interface(), results)
			if err != nil {
				return err
			}
			var key interface{}
			// if there is only one pk, we can put the id as map key.
			if len(table.PrimaryKeys) == 1 {
				key, err = Atot(string(results[table.PrimaryKeys[0]]), keyType)
				if err != nil {
					return err
				}
			} else {
				if keyType.Kind() != reflect.Slice {
					panic("don't support multiple primary key's map has non-slice key type")
				} else {
					keys := core.PK{}
					for _, pk := range table.PrimaryKeys {
						skey, err := Atot(string(results[pk]), keyType)
						if err != nil {
							return err
						}
						keys = append(keys, skey)
					}
					key = keys
				}
			}

			if sliceElementType.Kind() == reflect.Ptr {
				sliceValue.SetMapIndex(reflect.ValueOf(key), reflect.ValueOf(newValue.Interface()))
			} else {
				sliceValue.SetMapIndex(reflect.ValueOf(key), reflect.Indirect(reflect.ValueOf(newValue.Interface())))
			}
		}
	}
	return nil
}

// func (session *Session) queryRows(rawStmt **sql.Stmt, rawRows **sql.Rows, sqlStr string, args ...interface{}) error {
// 	var err error
// 	if session.IsAutoCommit {
// 		*rawStmt, err = session.doPrepare(sqlStr)
// 		if err != nil {
// 			return err
// 		}
// 		*rawRows, err = (*rawStmt).Query(args...)
// 	} else {
// 		*rawRows, err = session.Tx.Query(sqlStr, args...)
// 	}
// 	return err
// }

// Test if database is ok
func (session *Session) Ping() error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.DB().Ping()
}

/*
func (session *Session) isColumnExist(tableName string, col *core.Column) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}
	return session.Engine.dialect.IsColumnExist(tableName, col)
	//sqlStr, args := session.Engine.dialect.ColumnCheckSql(tableName, colName)
	//results, err := session.query(sqlStr, args...)
	//return len(results) > 0, err
}*/

func (engine *Engine) tableName(beanOrTableName interface{}) (string, error) {
	v := rValue(beanOrTableName)
	if v.Type().Kind() == reflect.String {
		return beanOrTableName.(string), nil
	} else if v.Type().Kind() == reflect.Struct {
		table := engine.autoMapType(v)
		return table.Name, nil
	}
	return "", errors.New("bean should be a struct or struct's point")
}

func (session *Session) IsTableExist(beanOrTableName interface{}) (bool, error) {
	tableName, err := session.Engine.tableName(beanOrTableName)
	if err != nil {
		return false, err
	}

	return session.isTableExist(tableName)
}

func (session *Session) isTableExist(tableName string) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}
	sqlStr, args := session.Engine.dialect.TableCheckSql(tableName)
	results, err := session.query(sqlStr, args...)
	return len(results) > 0, err
}

func (session *Session) IsTableEmpty(bean interface{}) (bool, error) {
	v := rValue(bean)
	t := v.Type()

	if t.Kind() == reflect.String {
		return session.isTableEmpty(bean.(string))
	} else if t.Kind() == reflect.Struct {
		session.Engine.autoMapType(v)
		rows, err := session.Count(bean)
		return rows == 0, err
	}
	return false, errors.New("bean should be a struct or struct's point")
}

func (session *Session) isTableEmpty(tableName string) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	var total int64
	sql := fmt.Sprintf("select count(*) from %s", session.Engine.Quote(tableName))
	err := session.DB().QueryRow(sql).Scan(&total)
	session.Engine.logSQL(sql)
	if err != nil {
		return true, err
	}

	return total == 0, nil
}

func (session *Session) isIndexExist(tableName, idxName string, unique bool) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}
	var idx string
	if unique {
		idx = uniqueName(tableName, idxName)
	} else {
		idx = indexName(tableName, idxName)
	}
	sqlStr, args := session.Engine.dialect.IndexCheckSql(tableName, idx)
	results, err := session.query(sqlStr, args...)
	return len(results) > 0, err
}

// find if index is exist according cols
func (session *Session) isIndexExist2(tableName string, cols []string, unique bool) (bool, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	indexes, err := session.Engine.dialect.GetIndexes(tableName)
	if err != nil {
		return false, err
	}

	for _, index := range indexes {
		if sliceEq(index.Cols, cols) {
			if unique {
				return index.Type == core.UniqueType, nil
			} else {
				return index.Type == core.IndexType, nil
			}
		}
	}
	return false, nil
}

func (session *Session) addColumn(colName string) error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	col := session.Statement.RefTable.GetColumn(colName)
	sql, args := session.Statement.genAddColumnStr(col)
	_, err := session.exec(sql, args...)
	return err
}

func (session *Session) addIndex(tableName, idxName string) error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}
	index := session.Statement.RefTable.Indexes[idxName]
	sqlStr := session.Engine.dialect.CreateIndexSql(tableName, index)

	_, err := session.exec(sqlStr)
	return err
}

func (session *Session) addUnique(tableName, uqeName string) error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}
	index := session.Statement.RefTable.Indexes[uqeName]
	sqlStr := session.Engine.dialect.CreateIndexSql(tableName, index)
	_, err := session.exec(sqlStr)
	return err
}

// To be deleted
func (session *Session) dropAll() error {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	for _, table := range session.Engine.Tables {
		session.Statement.Init()
		session.Statement.RefTable = table
		sqlStr := session.Engine.Dialect().DropTableSql(session.Statement.TableName())
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

func (session *Session) getField(dataStruct *reflect.Value, key string, table *core.Table, idx int) *reflect.Value {
	var col *core.Column
	if col = table.GetColumnIdx(key, idx); col == nil {
		session.Engine.LogWarn(fmt.Sprintf("table %v's has not column %v. %v", table.Name, key, table.Columns()))
		return nil
	}

	fieldValue, err := col.ValueOfV(dataStruct)
	if err != nil {
		session.Engine.LogError(err)
		return nil
	}

	if !fieldValue.IsValid() || !fieldValue.CanSet() {
		session.Engine.LogWarn("table %v's column %v is not valid or cannot set",
			table.Name, key)
		return nil
	}
	return fieldValue
}

type Cell *interface{}

func (session *Session) rows2Beans(rows *core.Rows, fields []string, fieldsCount int,
	table *core.Table, newElemFunc func() reflect.Value,
	sliceValueSetFunc func(*reflect.Value)) error {

	for rows.Next() {
		var newValue reflect.Value = newElemFunc()
		bean := newValue.Interface()
		dataStruct := rValue(bean)
		err := session._row2Bean(rows, fields, fieldsCount, bean, &dataStruct, table)
		if err != nil {
			return err
		}
		sliceValueSetFunc(&newValue)

	}
	return nil
}

func (session *Session) row2Bean(rows *core.Rows, fields []string, fieldsCount int, bean interface{}) error {
	dataStruct := rValue(bean)
	if dataStruct.Kind() != reflect.Struct {
		return errors.New("Expected a pointer to a struct")
	}

	table := session.Engine.autoMapType(dataStruct)
	return session._row2Bean(rows, fields, fieldsCount, bean, &dataStruct, table)
}

func (session *Session) _row2Bean(rows *core.Rows, fields []string, fieldsCount int, bean interface{}, dataStruct *reflect.Value, table *core.Table) error {
	scanResults := make([]interface{}, fieldsCount)
	for i := 0; i < len(fields); i++ {
		var cell interface{}
		scanResults[i] = &cell
	}
	if err := rows.Scan(scanResults...); err != nil {
		return err
	}

	if b, hasBeforeSet := bean.(BeforeSetProcessor); hasBeforeSet {
		for ii, key := range fields {
			b.BeforeSet(key, Cell(scanResults[ii].(*interface{})))
		}
	}

	var tempMap = make(map[string]int)
	for ii, key := range fields {
		var idx int
		var ok bool
		if idx, ok = tempMap[strings.ToLower(key)]; !ok {
			idx = 0
		} else {
			idx = idx + 1
		}
		tempMap[strings.ToLower(key)] = idx

		if fieldValue := session.getField(dataStruct, key, table, idx); fieldValue != nil {
			rawValue := reflect.Indirect(reflect.ValueOf(scanResults[ii]))

			//if row is null then ignore
			if rawValue.Interface() == nil {
				continue
			}

			if fieldValue.CanAddr() {
				if structConvert, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
					if data, err := value2Bytes(&rawValue); err == nil {
						structConvert.FromDB(data)
					} else {
						session.Engine.LogError(err)
					}
					continue
				}
			}

			if _, ok := fieldValue.Interface().(core.Conversion); ok {
				if data, err := value2Bytes(&rawValue); err == nil {
					if fieldValue.Kind() == reflect.Ptr && fieldValue.IsNil() {
						fieldValue.Set(reflect.New(fieldValue.Type().Elem()))
					}
					fieldValue.Interface().(core.Conversion).FromDB(data)
				} else {
					session.Engine.LogError(err)
				}
				continue
			}

			rawValueType := reflect.TypeOf(rawValue.Interface())
			vv := reflect.ValueOf(rawValue.Interface())

			fieldType := fieldValue.Type()
			hasAssigned := false

			switch fieldType.Kind() {

			case reflect.Complex64, reflect.Complex128:
				if rawValueType.Kind() == reflect.String {
					hasAssigned = true
					x := reflect.New(fieldType)
					err := json.Unmarshal([]byte(vv.String()), x.Interface())
					if err != nil {
						session.Engine.LogError(err)
						return err
					}
					fieldValue.Set(x.Elem())
				}
			case reflect.Slice, reflect.Array:
				switch rawValueType.Kind() {
				case reflect.Slice, reflect.Array:
					switch rawValueType.Elem().Kind() {
					case reflect.Uint8:
						if fieldType.Elem().Kind() == reflect.Uint8 {
							hasAssigned = true
							fieldValue.Set(vv)
						}
					}
				}
			case reflect.String:
				if rawValueType.Kind() == reflect.String {
					hasAssigned = true
					fieldValue.SetString(vv.String())
				}
			case reflect.Bool:
				if rawValueType.Kind() == reflect.Bool {
					hasAssigned = true
					fieldValue.SetBool(vv.Bool())
				}
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				switch rawValueType.Kind() {
				case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
					hasAssigned = true
					fieldValue.SetInt(vv.Int())
				}
			case reflect.Float32, reflect.Float64:
				switch rawValueType.Kind() {
				case reflect.Float32, reflect.Float64:
					hasAssigned = true
					fieldValue.SetFloat(vv.Float())
				}
			case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint:
				switch rawValueType.Kind() {
				case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint:
					hasAssigned = true
					fieldValue.SetUint(vv.Uint())
				case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
					hasAssigned = true
					fieldValue.SetUint(uint64(vv.Int()))
				}
			case reflect.Struct:
				if fieldType.ConvertibleTo(core.TimeType) {
					if rawValueType == core.TimeType {
						hasAssigned = true

						t := vv.Convert(core.TimeType).Interface().(time.Time)
						z, _ := t.Zone()
						if len(z) == 0 || t.Year() == 0 { // !nashtsai! HACK tmp work around for lib/pq doesn't properly time with location
							session.Engine.LogDebug("empty zone key[%v] : %v | zone: %v | location: %+v\n", key, t, z, *t.Location())
							t = time.Date(t.Year(), t.Month(), t.Day(), t.Hour(),
								t.Minute(), t.Second(), t.Nanosecond(), time.Local)
						}
						// !nashtsai! convert to engine location
						t = t.In(session.Engine.TZLocation)
						fieldValue.Set(reflect.ValueOf(t).Convert(fieldType))

						// t = fieldValue.Interface().(time.Time)
						// z, _ = t.Zone()
						// session.Engine.LogDebug("fieldValue key[%v]: %v | zone: %v | location: %+v\n", key, t, z, *t.Location())
					} else if rawValueType == core.IntType || rawValueType == core.Int64Type ||
						rawValueType == core.Int32Type {
						hasAssigned = true
						t := time.Unix(vv.Int(), 0).In(session.Engine.TZLocation)
						vv = reflect.ValueOf(t)
						fieldValue.Set(vv)
					}
				} else if session.Statement.UseCascade {
					table := session.Engine.autoMapType(*fieldValue)
					if table != nil {
						if len(table.PrimaryKeys) > 1 {
							panic("unsupported composited primary key cascade")
						}
						var pk = make(core.PK, len(table.PrimaryKeys))
						switch rawValueType.Kind() {
						case reflect.Int64:
							pk[0] = vv.Int()
						case reflect.Int:
							pk[0] = int(vv.Int())
						case reflect.Int32:
							pk[0] = int32(vv.Int())
						case reflect.Int16:
							pk[0] = int16(vv.Int())
						case reflect.Int8:
							pk[0] = int8(vv.Int())
						case reflect.Uint64:
							pk[0] = vv.Uint()
						case reflect.Uint:
							pk[0] = uint(vv.Uint())
						case reflect.Uint32:
							pk[0] = uint32(vv.Uint())
						case reflect.Uint16:
							pk[0] = uint16(vv.Uint())
						case reflect.Uint8:
							pk[0] = uint8(vv.Uint())
						case reflect.String:
							pk[0] = vv.String()
						default:
							panic("unsupported primary key type cascade")
						}

						if !isPKZero(pk) {
							// !nashtsai! TODO for hasOne relationship, it's preferred to use join query for eager fetch
							// however, also need to consider adding a 'lazy' attribute to xorm tag which allow hasOne
							// property to be fetched lazily
							structInter := reflect.New(fieldValue.Type())
							newsession := session.Engine.NewSession()
							defer newsession.Close()
							has, err := newsession.Id(pk).NoCascade().Get(structInter.Interface())
							if err != nil {
								return err
							}
							if has {
								v := structInter.Elem().Interface()
								fieldValue.Set(reflect.ValueOf(v))
							} else {
								return errors.New("cascade obj is not exist!")
							}
						}
					} else {
						session.Engine.LogError("unsupported struct type in Scan: ", fieldValue.Type().String())
					}
				}
			case reflect.Ptr:
				// !nashtsai! TODO merge duplicated codes above
				//typeStr := fieldType.String()
				switch fieldType {
				// following types case matching ptr's native type, therefore assign ptr directly
				case core.PtrStringType:
					if rawValueType.Kind() == reflect.String {
						x := vv.String()
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrBoolType:
					if rawValueType.Kind() == reflect.Bool {
						x := vv.Bool()
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrTimeType:
					if rawValueType == core.PtrTimeType {
						hasAssigned = true
						var x time.Time = rawValue.Interface().(time.Time)
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrFloat64Type:
					if rawValueType.Kind() == reflect.Float64 {
						x := vv.Float()
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrUint64Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x uint64 = uint64(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrInt64Type:
					if rawValueType.Kind() == reflect.Int64 {
						x := vv.Int()
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrFloat32Type:
					if rawValueType.Kind() == reflect.Float64 {
						var x float32 = float32(vv.Float())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrIntType:
					if rawValueType.Kind() == reflect.Int64 {
						var x int = int(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrInt32Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x int32 = int32(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrInt8Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x int8 = int8(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrInt16Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x int16 = int16(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrUintType:
					if rawValueType.Kind() == reflect.Int64 {
						var x uint = uint(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.PtrUint32Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x uint32 = uint32(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.Uint8Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x uint8 = uint8(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.Uint16Type:
					if rawValueType.Kind() == reflect.Int64 {
						var x uint16 = uint16(vv.Int())
						hasAssigned = true
						fieldValue.Set(reflect.ValueOf(&x))
					}
				case core.Complex64Type:
					var x complex64
					err := json.Unmarshal([]byte(vv.String()), &x)
					if err != nil {
						session.Engine.LogError(err)
					} else {
						fieldValue.Set(reflect.ValueOf(&x))
					}
					hasAssigned = true
				case core.Complex128Type:
					var x complex128
					err := json.Unmarshal([]byte(vv.String()), &x)
					if err != nil {
						session.Engine.LogError(err)
					} else {
						fieldValue.Set(reflect.ValueOf(&x))
					}
					hasAssigned = true
				} // switch fieldType
				// default:
				// 	session.Engine.LogError("unsupported type in Scan: ", reflect.TypeOf(v).String())
			} // switch fieldType.Kind()

			// !nashtsai! for value can't be assigned directly fallback to convert to []byte then back to value
			if !hasAssigned {
				data, err := value2Bytes(&rawValue)
				if err == nil {
					session.bytes2Value(table.GetColumn(key), fieldValue, data)
				} else {
					session.Engine.LogError(err.Error())
				}
			}
		}
	}
	return nil

}

func (session *Session) queryPreprocess(sqlStr *string, paramStr ...interface{}) {
	for _, filter := range session.Engine.dialect.Filters() {
		*sqlStr = filter.Do(*sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}

	session.Engine.logSQL(*sqlStr, paramStr...)
}

func (session *Session) query(sqlStr string, paramStr ...interface{}) (resultsSlice []map[string][]byte, err error) {

	session.queryPreprocess(&sqlStr, paramStr...)

	if session.IsAutoCommit {
		return session.innerQuery(session.DB(), sqlStr, paramStr...)
	}
	return session.txQuery(session.Tx, sqlStr, paramStr...)
}

func (session *Session) txQuery(tx *core.Tx, sqlStr string, params ...interface{}) (resultsSlice []map[string][]byte, err error) {
	rows, err := tx.Query(sqlStr, params...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return rows2maps(rows)
}

func (session *Session) innerQuery(db *core.DB, sqlStr string, params ...interface{}) (resultsSlice []map[string][]byte, err error) {
	stmt, rows, err := session.Engine.LogSQLQueryTime(sqlStr, params, func() (*core.Stmt, *core.Rows, error) {
		stmt, err := db.Prepare(sqlStr)
		if err != nil {
			return stmt, nil, err
		}
		rows, err := stmt.Query(params...)

		return stmt, rows, err
	})
	if rows != nil {
		defer rows.Close()
	}
	if stmt != nil {
		defer stmt.Close()
	}
	if err != nil {
		return nil, err
	}
	return rows2maps(rows)
}

// Exec a raw sql and return records as []map[string][]byte
func (session *Session) Query(sqlStr string, paramStr ...interface{}) (resultsSlice []map[string][]byte, err error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.query(sqlStr, paramStr...)
}

// =============================
// for string
// =============================
func (session *Session) query2(sqlStr string, paramStr ...interface{}) (resultsSlice []map[string]string, err error) {
	session.queryPreprocess(&sqlStr, paramStr...)

	if session.IsAutoCommit {
		return query2(session.DB(), sqlStr, paramStr...)
	}
	return txQuery2(session.Tx, sqlStr, paramStr...)
}

// insert one or more beans
func (session *Session) Insert(beans ...interface{}) (int64, error) {
	var affected int64 = 0
	var err error
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	for _, bean := range beans {
		sliceValue := reflect.Indirect(reflect.ValueOf(bean))
		if sliceValue.Kind() == reflect.Slice {
			size := sliceValue.Len()
			if size > 0 {
				if session.Engine.SupportInsertMany() {
					cnt, err := session.innerInsertMulti(bean)
					if err != nil {
						return affected, err
					}
					affected += cnt
				} else {
					for i := 0; i < size; i++ {
						cnt, err := session.innerInsert(sliceValue.Index(i).Interface())
						if err != nil {
							return affected, err
						}
						affected += cnt
					}
				}
			}
		} else {
			cnt, err := session.innerInsert(bean)
			if err != nil {
				return affected, err
			}
			affected += cnt
		}
	}

	return affected, err
}

func (session *Session) innerInsertMulti(rowsSlicePtr interface{}) (int64, error) {
	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() != reflect.Slice {
		return 0, errors.New("needs a pointer to a slice")
	}

	bean := sliceValue.Index(0).Interface()
	elementValue := rValue(bean)
	//sliceElementType := elementValue.Type()

	table := session.Engine.autoMapType(elementValue)
	session.Statement.RefTable = table

	size := sliceValue.Len()

	colNames := make([]string, 0)
	colMultiPlaces := make([]string, 0)
	var args = make([]interface{}, 0)
	cols := make([]*core.Column, 0)

	for i := 0; i < size; i++ {
		elemValue := sliceValue.Index(i).Interface()
		colPlaces := make([]string, 0)

		// handle BeforeInsertProcessor
		// !nashtsai! does user expect it's same slice to passed closure when using Before()/After() when insert multi??
		for _, closure := range session.beforeClosures {
			closure(elemValue)
		}

		if processor, ok := interface{}(elemValue).(BeforeInsertProcessor); ok {
			processor.BeforeInsert()
		}
		// --

		if i == 0 {
			for _, col := range table.Columns() {
				fieldValue := reflect.Indirect(reflect.ValueOf(elemValue)).FieldByName(col.FieldName)
				if col.IsAutoIncrement && fieldValue.Int() == 0 {
					continue
				}
				if col.MapType == core.ONLYFROMDB {
					continue
				}
				if col.IsDeleted {
					continue
				}
				if session.Statement.ColumnStr != "" {
					if _, ok := session.Statement.columnMap[col.Name]; !ok {
						continue
					}
				}
				if session.Statement.OmitStr != "" {
					if _, ok := session.Statement.columnMap[col.Name]; ok {
						continue
					}
				}
				if (col.IsCreated || col.IsUpdated) && session.Statement.UseAutoTime {
					val, t := session.Engine.NowTime2(col.SQLType.Name)
					args = append(args, val)

					var colName = col.Name
					session.afterClosures = append(session.afterClosures, func(bean interface{}) {
						col := table.GetColumn(colName)
						setColumnTime(bean, col, t)
					})
				} else {
					arg, err := session.value2Interface(col, fieldValue)
					if err != nil {
						return 0, err
					}
					args = append(args, arg)
				}

				colNames = append(colNames, col.Name)
				cols = append(cols, col)
				colPlaces = append(colPlaces, "?")
			}
		} else {
			for _, col := range cols {
				fieldValue := reflect.Indirect(reflect.ValueOf(elemValue)).FieldByName(col.FieldName)
				if col.IsAutoIncrement && fieldValue.Int() == 0 {
					continue
				}
				if col.MapType == core.ONLYFROMDB {
					continue
				}
				if col.IsDeleted {
					continue
				}
				if session.Statement.ColumnStr != "" {
					if _, ok := session.Statement.columnMap[col.Name]; !ok {
						continue
					}
				}
				if session.Statement.OmitStr != "" {
					if _, ok := session.Statement.columnMap[col.Name]; ok {
						continue
					}
				}
				if (col.IsCreated || col.IsUpdated) && session.Statement.UseAutoTime {
					val, t := session.Engine.NowTime2(col.SQLType.Name)
					args = append(args, val)

					var colName = col.Name
					session.afterClosures = append(session.afterClosures, func(bean interface{}) {
						col := table.GetColumn(colName)
						setColumnTime(bean, col, t)
					})
				} else {
					arg, err := session.value2Interface(col, fieldValue)
					if err != nil {
						return 0, err
					}
					args = append(args, arg)
				}

				colPlaces = append(colPlaces, "?")
			}
		}
		colMultiPlaces = append(colMultiPlaces, strings.Join(colPlaces, ", "))
	}
	cleanupProcessorsClosures(&session.beforeClosures)

	statement := fmt.Sprintf("INSERT INTO %v%v%v (%v%v%v) VALUES (%v)",
		session.Engine.QuoteStr(),
		session.Statement.TableName(),
		session.Engine.QuoteStr(),
		session.Engine.QuoteStr(),
		strings.Join(colNames, session.Engine.QuoteStr()+", "+session.Engine.QuoteStr()),
		session.Engine.QuoteStr(),
		strings.Join(colMultiPlaces, "),("))

	res, err := session.exec(statement, args...)
	if err != nil {
		return 0, err
	}

	if cacher := session.Engine.getCacher2(table); cacher != nil && session.Statement.UseCache {
		session.cacheInsert(session.Statement.TableName())
	}

	lenAfterClosures := len(session.afterClosures)
	for i := 0; i < size; i++ {
		elemValue := sliceValue.Index(i).Interface()
		// handle AfterInsertProcessor
		if session.IsAutoCommit {
			// !nashtsai! does user expect it's same slice to passed closure when using Before()/After() when insert multi??
			for _, closure := range session.afterClosures {
				closure(elemValue)
			}
			if processor, ok := interface{}(elemValue).(AfterInsertProcessor); ok {
				processor.AfterInsert()
			}
		} else {
			if lenAfterClosures > 0 {
				if value, has := session.afterInsertBeans[elemValue]; has && value != nil {
					*value = append(*value, session.afterClosures...)
				} else {
					afterClosures := make([]func(interface{}), lenAfterClosures)
					copy(afterClosures, session.afterClosures)
					session.afterInsertBeans[elemValue] = &afterClosures
				}
			} else {
				if _, ok := interface{}(elemValue).(AfterInsertProcessor); ok {
					session.afterInsertBeans[elemValue] = nil
				}
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures)
	return res.RowsAffected()
}

// Insert multiple records
func (session *Session) InsertMulti(rowsSlicePtr interface{}) (int64, error) {
	sliceValue := reflect.Indirect(reflect.ValueOf(rowsSlicePtr))
	if sliceValue.Kind() == reflect.Slice {
		if sliceValue.Len() > 0 {
			defer session.resetStatement()
			if session.IsAutoClose {
				defer session.Close()
			}
			return session.innerInsertMulti(rowsSlicePtr)
		} else {
			return 0, nil
		}
	} else {
		return 0, ErrParamsType
	}
}

func (session *Session) byte2Time(col *core.Column, data []byte) (outTime time.Time, outErr error) {
	sdata := strings.TrimSpace(string(data))
	var x time.Time
	var err error

	if sdata == "0000-00-00 00:00:00" ||
		sdata == "0001-01-01 00:00:00" {
	} else if !strings.ContainsAny(sdata, "- :") { // !nashtsai! has only found that mymysql driver is using this for time type column
		// time stamp
		sd, err := strconv.ParseInt(sdata, 10, 64)
		if err == nil {
			x = time.Unix(0, sd)
			// !nashtsai! HACK mymysql driver is casuing Local location being change to CHAT and cause wrong time conversion
			x = x.In(time.UTC)
			x = time.Date(x.Year(), x.Month(), x.Day(), x.Hour(),
				x.Minute(), x.Second(), x.Nanosecond(), session.Engine.TZLocation)
			session.Engine.LogDebugf("time(0) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
		} else {
			session.Engine.LogDebugf("time(0) err key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
		}
	} else if len(sdata) > 19 {

		x, err = time.ParseInLocation(time.RFC3339Nano, sdata, session.Engine.TZLocation)
		session.Engine.LogDebugf("time(1) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
		if err != nil {
			x, err = time.ParseInLocation("2006-01-02 15:04:05.999999999", sdata, session.Engine.TZLocation)
			session.Engine.LogDebugf("time(2) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
		}
		if err != nil {
			x, err = time.ParseInLocation("2006-01-02 15:04:05.9999999 Z07:00", sdata, session.Engine.TZLocation)
			session.Engine.LogDebugf("time(3) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
		}

	} else if len(sdata) == 19 {
		x, err = time.ParseInLocation("2006-01-02 15:04:05", sdata, session.Engine.TZLocation)
		session.Engine.LogDebugf("time(4) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
	} else if len(sdata) == 10 && sdata[4] == '-' && sdata[7] == '-' {
		x, err = time.ParseInLocation("2006-01-02", sdata, session.Engine.TZLocation)
		session.Engine.LogDebugf("time(5) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
	} else if col.SQLType.Name == core.Time {
		if strings.Contains(sdata, " ") {
			ssd := strings.Split(sdata, " ")
			sdata = ssd[1]
		}

		sdata = strings.TrimSpace(sdata)
		if session.Engine.dialect.DBType() == core.MYSQL && len(sdata) > 8 {
			sdata = sdata[len(sdata)-8:]
		}

		st := fmt.Sprintf("2006-01-02 %v", sdata)
		x, err = time.ParseInLocation("2006-01-02 15:04:05", st, session.Engine.TZLocation)
		session.Engine.LogDebugf("time(6) key[%v]: %+v | sdata: [%v]\n", col.FieldName, x, sdata)
	} else {
		outErr = errors.New(fmt.Sprintf("unsupported time format %v", sdata))
		return
	}
	if err != nil {
		outErr = errors.New(fmt.Sprintf("unsupported time format %v: %v", sdata, err))
		return
	}
	outTime = x
	return
}

// convert a db data([]byte) to a field value
func (session *Session) bytes2Value(col *core.Column, fieldValue *reflect.Value, data []byte) error {
	if structConvert, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
		return structConvert.FromDB(data)
	}

	if structConvert, ok := fieldValue.Interface().(core.Conversion); ok {
		return structConvert.FromDB(data)
	}

	var v interface{}
	key := col.Name
	fieldType := fieldValue.Type()

	switch fieldType.Kind() {
	case reflect.Complex64, reflect.Complex128:
		x := reflect.New(fieldType)

		err := json.Unmarshal(data, x.Interface())
		if err != nil {
			session.Engine.LogError(err)
			return err
		}
		fieldValue.Set(x.Elem())
	case reflect.Slice, reflect.Array, reflect.Map:
		v = data
		t := fieldType.Elem()
		k := t.Kind()
		if col.SQLType.IsText() {
			x := reflect.New(fieldType)
			err := json.Unmarshal(data, x.Interface())
			if err != nil {
				session.Engine.LogError(err)
				return err
			}
			fieldValue.Set(x.Elem())
		} else if col.SQLType.IsBlob() {
			if k == reflect.Uint8 {
				fieldValue.Set(reflect.ValueOf(v))
			} else {
				x := reflect.New(fieldType)
				err := json.Unmarshal(data, x.Interface())
				if err != nil {
					session.Engine.LogError(err)
					return err
				}
				fieldValue.Set(x.Elem())
			}
		} else {
			return ErrUnSupportedType
		}
	case reflect.String:
		fieldValue.SetString(string(data))
	case reflect.Bool:
		d := string(data)
		v, err := strconv.ParseBool(d)
		if err != nil {
			return fmt.Errorf("arg %v as bool: %s", key, err.Error())
		}
		fieldValue.Set(reflect.ValueOf(v))
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		sdata := string(data)
		var x int64
		var err error
		// for mysql, when use bit, it returned \x01
		if col.SQLType.Name == core.Bit &&
			session.Engine.dialect.DBType() == core.MYSQL { // !nashtsai! TODO dialect needs to provide conversion interface API
			if len(data) == 1 {
				x = int64(data[0])
			} else {
				x = 0
			}
			//fmt.Println("######", x, data)
		} else if strings.HasPrefix(sdata, "0x") {
			x, err = strconv.ParseInt(sdata, 16, 64)
		} else if strings.HasPrefix(sdata, "0") {
			x, err = strconv.ParseInt(sdata, 8, 64)
		} else if strings.ToLower(sdata) == "true" {
			x = 1
		} else if strings.ToLower(sdata) == "false" {
			x = 0
		} else {
			x, err = strconv.ParseInt(sdata, 10, 64)
		}
		if err != nil {
			return fmt.Errorf("arg %v as int: %s", key, err.Error())
		}
		fieldValue.SetInt(x)
	case reflect.Float32, reflect.Float64:
		x, err := strconv.ParseFloat(string(data), 64)
		if err != nil {
			return fmt.Errorf("arg %v as float64: %s", key, err.Error())
		}
		fieldValue.SetFloat(x)
	case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint:
		x, err := strconv.ParseUint(string(data), 10, 64)
		if err != nil {
			return fmt.Errorf("arg %v as int: %s", key, err.Error())
		}
		fieldValue.SetUint(x)
	//Currently only support Time type
	case reflect.Struct:
		if fieldType.ConvertibleTo(core.TimeType) {
			x, err := session.byte2Time(col, data)
			if err != nil {
				return err
			}
			v = x
			fieldValue.Set(reflect.ValueOf(v).Convert(fieldType))
		} else if session.Statement.UseCascade {
			table := session.Engine.autoMapType(*fieldValue)
			if table != nil {
				if len(table.PrimaryKeys) > 1 {
					panic("unsupported composited primary key cascade")
				}
				var pk = make(core.PK, len(table.PrimaryKeys))
				rawValueType := table.ColumnType(table.PKColumns()[0].FieldName)
				switch rawValueType.Kind() {
				case reflect.Int64:
					x, err := strconv.ParseInt(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = x
				case reflect.Int:
					x, err := strconv.ParseInt(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = int(x)
				case reflect.Int32:
					x, err := strconv.ParseInt(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = int32(x)
				case reflect.Int16:
					x, err := strconv.ParseInt(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = int16(x)
				case reflect.Int8:
					x, err := strconv.ParseInt(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = int8(x)
				case reflect.Uint64:
					x, err := strconv.ParseUint(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = x
				case reflect.Uint:
					x, err := strconv.ParseUint(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = uint(x)
				case reflect.Uint32:
					x, err := strconv.ParseUint(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = uint32(x)
				case reflect.Uint16:
					x, err := strconv.ParseUint(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = uint16(x)
				case reflect.Uint8:
					x, err := strconv.ParseUint(string(data), 10, 64)
					if err != nil {
						return fmt.Errorf("arg %v as int: %s", key, err.Error())
					}
					pk[0] = uint8(x)
				case reflect.String:
					pk[0] = string(data)
				default:
					panic("unsupported primary key type cascade")
				}

				if !isPKZero(pk) {
					// !nashtsai! TODO for hasOne relationship, it's preferred to use join query for eager fetch
					// however, also need to consider adding a 'lazy' attribute to xorm tag which allow hasOne
					// property to be fetched lazily
					structInter := reflect.New(fieldValue.Type())
					newsession := session.Engine.NewSession()
					defer newsession.Close()
					has, err := newsession.Id(pk).NoCascade().Get(structInter.Interface())
					if err != nil {
						return err
					}
					if has {
						v = structInter.Elem().Interface()
						fieldValue.Set(reflect.ValueOf(v))
					} else {
						return errors.New("cascade obj is not exist!")
					}
				}
			} else {
				return fmt.Errorf("unsupported struct type in Scan: %s", fieldValue.Type().String())
			}
		}
	case reflect.Ptr:
		// !nashtsai! TODO merge duplicated codes above
		//typeStr := fieldType.String()
		switch fieldType {
		// case "*string":
		case core.PtrStringType:
			x := string(data)
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*bool":
		case core.PtrBoolType:
			d := string(data)
			v, err := strconv.ParseBool(d)
			if err != nil {
				return fmt.Errorf("arg %v as bool: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&v))
		// case "*complex64":
		case core.PtrComplex64Type:
			var x complex64
			err := json.Unmarshal(data, &x)
			if err != nil {
				session.Engine.LogError(err)
				return err
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*complex128":
		case core.PtrComplex128Type:
			var x complex128
			err := json.Unmarshal(data, &x)
			if err != nil {
				session.Engine.LogError(err)
				return err
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*float64":
		case core.PtrFloat64Type:
			x, err := strconv.ParseFloat(string(data), 64)
			if err != nil {
				return fmt.Errorf("arg %v as float64: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*float32":
		case core.PtrFloat32Type:
			var x float32
			x1, err := strconv.ParseFloat(string(data), 32)
			if err != nil {
				return fmt.Errorf("arg %v as float32: %s", key, err.Error())
			}
			x = float32(x1)
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*time.Time":
		case core.PtrTimeType:
			x, err := session.byte2Time(col, data)
			if err != nil {
				return err
			}
			v = x
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*uint64":
		case core.PtrUint64Type:
			var x uint64
			x, err := strconv.ParseUint(string(data), 10, 64)
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*uint":
		case core.PtrUintType:
			var x uint
			x1, err := strconv.ParseUint(string(data), 10, 64)
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			x = uint(x1)
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*uint32":
		case core.PtrUint32Type:
			var x uint32
			x1, err := strconv.ParseUint(string(data), 10, 64)
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			x = uint32(x1)
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*uint8":
		case core.PtrUint8Type:
			var x uint8
			x1, err := strconv.ParseUint(string(data), 10, 64)
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			x = uint8(x1)
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*uint16":
		case core.PtrUint16Type:
			var x uint16
			x1, err := strconv.ParseUint(string(data), 10, 64)
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			x = uint16(x1)
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*int64":
		case core.PtrInt64Type:
			sdata := string(data)
			var x int64
			var err error
			// for mysql, when use bit, it returned \x01
			if col.SQLType.Name == core.Bit &&
				strings.Contains(session.Engine.DriverName(), "mysql") {
				if len(data) == 1 {
					x = int64(data[0])
				} else {
					x = 0
				}
				//fmt.Println("######", x, data)
			} else if strings.HasPrefix(sdata, "0x") {
				x, err = strconv.ParseInt(sdata, 16, 64)
			} else if strings.HasPrefix(sdata, "0") {
				x, err = strconv.ParseInt(sdata, 8, 64)
			} else {
				x, err = strconv.ParseInt(sdata, 10, 64)
			}
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*int":
		case core.PtrIntType:
			sdata := string(data)
			var x int
			var x1 int64
			var err error
			// for mysql, when use bit, it returned \x01
			if col.SQLType.Name == core.Bit &&
				strings.Contains(session.Engine.DriverName(), "mysql") {
				if len(data) == 1 {
					x = int(data[0])
				} else {
					x = 0
				}
				//fmt.Println("######", x, data)
			} else if strings.HasPrefix(sdata, "0x") {
				x1, err = strconv.ParseInt(sdata, 16, 64)
				x = int(x1)
			} else if strings.HasPrefix(sdata, "0") {
				x1, err = strconv.ParseInt(sdata, 8, 64)
				x = int(x1)
			} else {
				x1, err = strconv.ParseInt(sdata, 10, 64)
				x = int(x1)
			}
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*int32":
		case core.PtrInt32Type:
			sdata := string(data)
			var x int32
			var x1 int64
			var err error
			// for mysql, when use bit, it returned \x01
			if col.SQLType.Name == core.Bit &&
				session.Engine.dialect.DBType() == core.MYSQL {
				if len(data) == 1 {
					x = int32(data[0])
				} else {
					x = 0
				}
				//fmt.Println("######", x, data)
			} else if strings.HasPrefix(sdata, "0x") {
				x1, err = strconv.ParseInt(sdata, 16, 64)
				x = int32(x1)
			} else if strings.HasPrefix(sdata, "0") {
				x1, err = strconv.ParseInt(sdata, 8, 64)
				x = int32(x1)
			} else {
				x1, err = strconv.ParseInt(sdata, 10, 64)
				x = int32(x1)
			}
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*int8":
		case core.PtrInt8Type:
			sdata := string(data)
			var x int8
			var x1 int64
			var err error
			// for mysql, when use bit, it returned \x01
			if col.SQLType.Name == core.Bit &&
				strings.Contains(session.Engine.DriverName(), "mysql") {
				if len(data) == 1 {
					x = int8(data[0])
				} else {
					x = 0
				}
				//fmt.Println("######", x, data)
			} else if strings.HasPrefix(sdata, "0x") {
				x1, err = strconv.ParseInt(sdata, 16, 64)
				x = int8(x1)
			} else if strings.HasPrefix(sdata, "0") {
				x1, err = strconv.ParseInt(sdata, 8, 64)
				x = int8(x1)
			} else {
				x1, err = strconv.ParseInt(sdata, 10, 64)
				x = int8(x1)
			}
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		// case "*int16":
		case core.PtrInt16Type:
			sdata := string(data)
			var x int16
			var x1 int64
			var err error
			// for mysql, when use bit, it returned \x01
			if col.SQLType.Name == core.Bit &&
				strings.Contains(session.Engine.DriverName(), "mysql") {
				if len(data) == 1 {
					x = int16(data[0])
				} else {
					x = 0
				}
				//fmt.Println("######", x, data)
			} else if strings.HasPrefix(sdata, "0x") {
				x1, err = strconv.ParseInt(sdata, 16, 64)
				x = int16(x1)
			} else if strings.HasPrefix(sdata, "0") {
				x1, err = strconv.ParseInt(sdata, 8, 64)
				x = int16(x1)
			} else {
				x1, err = strconv.ParseInt(sdata, 10, 64)
				x = int16(x1)
			}
			if err != nil {
				return fmt.Errorf("arg %v as int: %s", key, err.Error())
			}
			fieldValue.Set(reflect.ValueOf(&x))
		default:
			if fieldType.Elem().Kind() == reflect.Struct {
				if session.Statement.UseCascade {
					structInter := reflect.New(fieldType.Elem())
					table := session.Engine.autoMapType(structInter.Elem())
					if table != nil {
						if len(table.PrimaryKeys) > 1 {
							panic("unsupported composited primary key cascade")
						}
						var pk = make(core.PK, len(table.PrimaryKeys))
						rawValueType := table.ColumnType(table.PKColumns()[0].FieldName)
						switch rawValueType.Kind() {
						case reflect.Int64:
							x, err := strconv.ParseInt(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = x
						case reflect.Int:
							x, err := strconv.ParseInt(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = int(x)
						case reflect.Int32:
							x, err := strconv.ParseInt(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = int32(x)
						case reflect.Int16:
							x, err := strconv.ParseInt(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = int16(x)
						case reflect.Int8:
							x, err := strconv.ParseInt(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = x
						case reflect.Uint64:
							x, err := strconv.ParseUint(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = x
						case reflect.Uint:
							x, err := strconv.ParseUint(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = uint(x)
						case reflect.Uint32:
							x, err := strconv.ParseUint(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = uint32(x)
						case reflect.Uint16:
							x, err := strconv.ParseUint(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = uint16(x)
						case reflect.Uint8:
							x, err := strconv.ParseUint(string(data), 10, 64)
							if err != nil {
								return fmt.Errorf("arg %v as int: %s", key, err.Error())
							}

							pk[0] = uint8(x)
						case reflect.String:
							pk[0] = string(data)
						default:
							panic("unsupported primary key type cascade")
						}

						if !isPKZero(pk) {
							// !nashtsai! TODO for hasOne relationship, it's preferred to use join query for eager fetch
							// however, also need to consider adding a 'lazy' attribute to xorm tag which allow hasOne
							// property to be fetched lazily
							newsession := session.Engine.NewSession()
							defer newsession.Close()
							has, err := newsession.Id(pk).NoCascade().Get(structInter.Interface())
							if err != nil {
								return err
							}
							if has {
								v = structInter.Interface()
								fieldValue.Set(reflect.ValueOf(v))
							} else {
								return errors.New("cascade obj is not exist!")
							}
						}
					}
				} else {
					return fmt.Errorf("unsupported struct type in Scan: %s", fieldValue.Type().String())
				}
			}
			return fmt.Errorf("unsupported type in Scan: %s", reflect.TypeOf(v).String())
		}
	default:
		return fmt.Errorf("unsupported type in Scan: %s", reflect.TypeOf(v).String())
	}

	return nil
}

// convert a field value of a struct to interface for put into db
func (session *Session) value2Interface(col *core.Column, fieldValue reflect.Value) (interface{}, error) {
	if fieldValue.CanAddr() {
		if fieldConvert, ok := fieldValue.Addr().Interface().(core.Conversion); ok {
			data, err := fieldConvert.ToDB()
			if err != nil {
				return 0, err
			} else {
				return string(data), nil
			}
		}
	}

	if fieldConvert, ok := fieldValue.Interface().(core.Conversion); ok {
		data, err := fieldConvert.ToDB()
		if err != nil {
			return 0, err
		} else {
			return string(data), nil
		}
	}

	fieldType := fieldValue.Type()
	k := fieldType.Kind()
	if k == reflect.Ptr {
		if fieldValue.IsNil() {
			return nil, nil
		} else if !fieldValue.IsValid() {
			session.Engine.LogWarn("the field[", col.FieldName, "] is invalid")
			return nil, nil
		} else {
			// !nashtsai! deference pointer type to instance type
			fieldValue = fieldValue.Elem()
			fieldType = fieldValue.Type()
			k = fieldType.Kind()
		}
	}

	switch k {
	case reflect.Bool:
		return fieldValue.Bool(), nil
	case reflect.String:
		return fieldValue.String(), nil
	case reflect.Struct:
		if fieldType == core.TimeType {
			switch fieldValue.Interface().(type) {
			case time.Time:
				t := fieldValue.Interface().(time.Time)
				if session.Engine.dialect.DBType() == core.MSSQL {
					if t.IsZero() {
						return nil, nil
					}
				}
				tf := session.Engine.FormatTime(col.SQLType.Name, t)
				return tf, nil
			default:
				return fieldValue.Interface(), nil
			}
		}
		if fieldTable, ok := session.Engine.Tables[fieldValue.Type()]; ok {
			if len(fieldTable.PrimaryKeys) == 1 {
				pkField := reflect.Indirect(fieldValue).FieldByName(fieldTable.PKColumns()[0].FieldName)
				return pkField.Interface(), nil
			} else {
				return 0, fmt.Errorf("no primary key for col %v", col.Name)
			}
		} else {
			return 0, fmt.Errorf("Unsupported type %v\n", fieldValue.Type())
		}
	case reflect.Complex64, reflect.Complex128:
		bytes, err := json.Marshal(fieldValue.Interface())
		if err != nil {
			session.Engine.LogError(err)
			return 0, err
		}
		return string(bytes), nil
	case reflect.Array, reflect.Slice, reflect.Map:
		if !fieldValue.IsValid() {
			return fieldValue.Interface(), nil
		}

		if col.SQLType.IsText() {
			bytes, err := json.Marshal(fieldValue.Interface())
			if err != nil {
				session.Engine.LogError(err)
				return 0, err
			}
			return string(bytes), nil
		} else if col.SQLType.IsBlob() {
			var bytes []byte
			var err error
			if (k == reflect.Array || k == reflect.Slice) &&
				(fieldValue.Type().Elem().Kind() == reflect.Uint8) {
				bytes = fieldValue.Bytes()
			} else {
				bytes, err = json.Marshal(fieldValue.Interface())
				if err != nil {
					session.Engine.LogError(err)
					return 0, err
				}
			}
			return bytes, nil
		} else {
			return nil, ErrUnSupportedType
		}
	case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint:
		return int64(fieldValue.Uint()), nil
	default:
		return fieldValue.Interface(), nil
	}
}

func (session *Session) innerInsert(bean interface{}) (int64, error) {
	table := session.Engine.TableInfo(bean)
	session.Statement.RefTable = table

	// handle BeforeInsertProcessor
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures) // cleanup after used

	if processor, ok := interface{}(bean).(BeforeInsertProcessor); ok {
		processor.BeforeInsert()
	}
	// --

	colNames, args, err := genCols(table, session, bean, false, false)
	if err != nil {
		return 0, err
	}

	// insert expr columns, override if exists
	exprColumns := session.Statement.getExpr()
	exprColVals := make([]string, 0, len(exprColumns))
	for _, v := range exprColumns {
		// remove the expr columns
		for i, colName := range colNames {
			if colName == v.colName {
				colNames = append(colNames[:i], colNames[i+1:]...)
				args = append(args[:i], args[i+1:]...)
			}
		}

		// append expr column to the end
		colNames = append(colNames, v.colName)
		exprColVals = append(exprColVals, v.expr)
	}

	colPlaces := strings.Repeat("?, ", len(colNames)-len(exprColumns))
	if len(exprColVals) > 0 {
		colPlaces = colPlaces + strings.Join(exprColVals, ", ")
	} else {
		colPlaces = colPlaces[0 : len(colPlaces)-2]
	}

	sqlStr := fmt.Sprintf("INSERT INTO %v%v%v (%v%v%v) VALUES (%v)",
		session.Engine.QuoteStr(),
		session.Statement.TableName(),
		session.Engine.QuoteStr(),
		session.Engine.QuoteStr(),
		strings.Join(colNames, session.Engine.Quote(", ")),
		session.Engine.QuoteStr(),
		colPlaces)

	handleAfterInsertProcessorFunc := func(bean interface{}) {

		if session.IsAutoCommit {
			for _, closure := range session.afterClosures {
				closure(bean)
			}
			if processor, ok := interface{}(bean).(AfterInsertProcessor); ok {
				processor.AfterInsert()
			}
		} else {
			lenAfterClosures := len(session.afterClosures)
			if lenAfterClosures > 0 {
				if value, has := session.afterInsertBeans[bean]; has && value != nil {
					*value = append(*value, session.afterClosures...)
				} else {
					afterClosures := make([]func(interface{}), lenAfterClosures)
					copy(afterClosures, session.afterClosures)
					session.afterInsertBeans[bean] = &afterClosures
				}

			} else {
				if _, ok := interface{}(bean).(AfterInsertProcessor); ok {
					session.afterInsertBeans[bean] = nil
				}
			}
		}
		cleanupProcessorsClosures(&session.afterClosures) // cleanup after used
	}

	// for postgres, many of them didn't implement lastInsertId, so we should
	// implemented it ourself.

	if session.Engine.DriverName() != core.POSTGRES || table.AutoIncrement == "" {
		res, err := session.exec(sqlStr, args...)
		if err != nil {
			return 0, err
		} else {
			handleAfterInsertProcessorFunc(bean)
		}

		if cacher := session.Engine.getCacher2(table); cacher != nil && session.Statement.UseCache {
			session.cacheInsert(session.Statement.TableName())
		}

		if table.Version != "" && session.Statement.checkVersion {
			verValue, err := table.VersionColumn().ValueOf(bean)
			if err != nil {
				session.Engine.LogError(err)
			} else if verValue.IsValid() && verValue.CanSet() {
				verValue.SetInt(1)
			}
		}

		if table.AutoIncrement == "" {
			return res.RowsAffected()
		}

		var id int64 = 0
		id, err = res.LastInsertId()
		if err != nil || id <= 0 {
			return res.RowsAffected()
		}

		aiValue, err := table.AutoIncrColumn().ValueOf(bean)
		if err != nil {
			session.Engine.LogError(err)
		}

		if aiValue == nil || !aiValue.IsValid() /*|| aiValue.Int() != 0*/ || !aiValue.CanSet() {
			return res.RowsAffected()
		}

		var v interface{} = id
		switch aiValue.Type().Kind() {
		case reflect.Int32:
			v = int32(id)
		case reflect.Int:
			v = int(id)
		case reflect.Uint32:
			v = uint32(id)
		case reflect.Uint64:
			v = uint64(id)
		case reflect.Uint:
			v = uint(id)
		}
		aiValue.Set(reflect.ValueOf(v))

		return res.RowsAffected()
	} else {
		//assert table.AutoIncrement != ""
		sqlStr = sqlStr + " RETURNING " + session.Engine.Quote(table.AutoIncrement)
		res, err := session.query(sqlStr, args...)

		if err != nil {
			return 0, err
		} else {
			handleAfterInsertProcessorFunc(bean)
		}

		if cacher := session.Engine.getCacher2(table); cacher != nil && session.Statement.UseCache {
			session.cacheInsert(session.Statement.TableName())
		}

		if table.Version != "" && session.Statement.checkVersion {
			verValue, err := table.VersionColumn().ValueOf(bean)
			if err != nil {
				session.Engine.LogError(err)
			} else if verValue.IsValid() && verValue.CanSet() {
				verValue.SetInt(1)
			}
		}

		if len(res) < 1 {
			return 0, errors.New("insert no error but not returned id")
		}

		idByte := res[0][table.AutoIncrement]
		id, err := strconv.ParseInt(string(idByte), 10, 64)
		if err != nil {
			return 1, err
		}

		aiValue, err := table.AutoIncrColumn().ValueOf(bean)
		if err != nil {
			session.Engine.LogError(err)
		}

		if aiValue == nil || !aiValue.IsValid() /*|| aiValue. != 0*/ || !aiValue.CanSet() {
			return 1, nil
		}

		var v interface{} = id
		switch aiValue.Type().Kind() {
		case reflect.Int32:
			v = int32(id)
		case reflect.Int:
			v = int(id)
		case reflect.Uint32:
			v = uint32(id)
		case reflect.Uint64:
			v = uint64(id)
		case reflect.Uint:
			v = uint(id)
		}
		aiValue.Set(reflect.ValueOf(v))

		return 1, nil
	}
}

// Method InsertOne insert only one struct into database as a record.
// The in parameter bean must a struct or a point to struct. The return
// parameter is inserted and error
func (session *Session) InsertOne(bean interface{}) (int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	return session.innerInsert(bean)
}

func (statement *Statement) convertUpdateSql(sqlStr string) (string, string) {
	if statement.RefTable == nil || len(statement.RefTable.PrimaryKeys) != 1 {
		return "", ""
	}

	colstrs := statement.JoinColumns(statement.RefTable.PKColumns())
	sqls := splitNNoCase(sqlStr, "where", 2)
	if len(sqls) != 2 {
		if len(sqls) == 1 {
			return sqls[0], fmt.Sprintf("SELECT %v FROM %v",
				colstrs, statement.Engine.Quote(statement.TableName()))
		}
		return "", ""
	}

	var whereStr = sqls[1]

	//TODO: for postgres only, if any other database?
	var paraStr string
	if statement.Engine.dialect.DBType() == core.POSTGRES {
		paraStr = "$"
	} else if statement.Engine.dialect.DBType() == core.MSSQL {
		paraStr = ":"
	}

	if paraStr != "" {
		if strings.Contains(sqls[1], paraStr) {
			dollers := strings.Split(sqls[1], paraStr)
			whereStr = dollers[0]
			for i, c := range dollers[1:] {
				ccs := strings.SplitN(c, " ", 2)
				whereStr += fmt.Sprintf(paraStr+"%v %v", i+1, ccs[1])
			}
		}
	}

	return sqls[0], fmt.Sprintf("SELECT %v FROM %v WHERE %v",
		colstrs, statement.Engine.Quote(statement.TableName()),
		whereStr)
}

func (session *Session) cacheInsert(tables ...string) error {
	if session.Statement.RefTable == nil {
		return ErrCacheFailed
	}

	table := session.Statement.RefTable
	cacher := session.Engine.getCacher2(table)

	for _, t := range tables {
		session.Engine.LogDebug("[cache] clear sql:", t)
		cacher.ClearIds(t)
	}

	return nil
}

func (session *Session) cacheUpdate(sqlStr string, args ...interface{}) error {
	if session.Statement.RefTable == nil || len(session.Statement.RefTable.PrimaryKeys) != 1 {
		return ErrCacheFailed
	}

	oldhead, newsql := session.Statement.convertUpdateSql(sqlStr)
	if newsql == "" {
		return ErrCacheFailed
	}
	for _, filter := range session.Engine.dialect.Filters() {
		newsql = filter.Do(newsql, session.Engine.dialect, session.Statement.RefTable)
	}
	session.Engine.LogDebug("[cacheUpdate] new sql", oldhead, newsql)

	var nStart int
	if len(args) > 0 {
		if strings.Index(sqlStr, "?") > -1 {
			nStart = strings.Count(oldhead, "?")
		} else {
			// only for pq, TODO: if any other databse?
			nStart = strings.Count(oldhead, "$")
		}
	}
	table := session.Statement.RefTable
	cacher := session.Engine.getCacher2(table)
	tableName := session.Statement.TableName()
	session.Engine.LogDebug("[cacheUpdate] get cache sql", newsql, args[nStart:])
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args[nStart:])
	if err != nil {
		rows, err := session.DB().Query(newsql, args[nStart:]...)
		if err != nil {
			return err
		}
		defer rows.Close()

		ids = make([]core.PK, 0)
		for rows.Next() {
			var res = make([]string, len(table.PrimaryKeys))
			err = rows.ScanSlice(&res)
			if err != nil {
				return err
			}
			var pk core.PK = make([]interface{}, len(table.PrimaryKeys))
			for i, col := range table.PKColumns() {
				if col.SQLType.IsNumeric() {
					n, err := strconv.ParseInt(res[i], 10, 64)
					if err != nil {
						return err
					}
					pk[i] = n
				} else if col.SQLType.IsText() {
					pk[i] = res[i]
				} else {
					return errors.New("not supported")
				}
			}

			ids = append(ids, pk)
		}
		session.Engine.LogDebug("[cacheUpdate] find updated id", ids)
	} /*else {
	    session.Engine.LogDebug("[xorm:cacheUpdate] del cached sql:", tableName, newsql, args)
	    cacher.DelIds(tableName, genSqlKey(newsql, args))
	}*/

	for _, id := range ids {
		sid, err := id.ToString()
		if err != nil {
			return err
		}
		if bean := cacher.GetBean(tableName, sid); bean != nil {
			sqls := splitNNoCase(sqlStr, "where", 2)
			if len(sqls) == 0 || len(sqls) > 2 {
				return ErrCacheFailed
			}

			sqls = splitNNoCase(sqls[0], "set", 2)
			if len(sqls) != 2 {
				return ErrCacheFailed
			}
			kvs := strings.Split(strings.TrimSpace(sqls[1]), ",")
			for idx, kv := range kvs {
				sps := strings.SplitN(kv, "=", 2)
				sps2 := strings.Split(sps[0], ".")
				colName := sps2[len(sps2)-1]
				if strings.Contains(colName, "`") {
					colName = strings.TrimSpace(strings.Replace(colName, "`", "", -1))
				} else if strings.Contains(colName, session.Engine.QuoteStr()) {
					colName = strings.TrimSpace(strings.Replace(colName, session.Engine.QuoteStr(), "", -1))
				} else {
					session.Engine.LogDebug("[cacheUpdate] cannot find column", tableName, colName)
					return ErrCacheFailed
				}

				if col := table.GetColumn(colName); col != nil {
					fieldValue, err := col.ValueOf(bean)
					if err != nil {
						session.Engine.LogError(err)
					} else {
						session.Engine.LogDebug("[cacheUpdate] set bean field", bean, colName, fieldValue.Interface())
						if col.IsVersion && session.Statement.checkVersion {
							fieldValue.SetInt(fieldValue.Int() + 1)
						} else {
							fieldValue.Set(reflect.ValueOf(args[idx]))
						}
					}
				} else {
					session.Engine.LogErrorf("[cacheUpdate] ERROR: column %v is not table %v's",
						colName, table.Name)
				}
			}

			session.Engine.LogDebug("[cacheUpdate] update cache", tableName, id, bean)
			cacher.PutBean(tableName, sid, bean)
		}
	}
	session.Engine.LogDebug("[cacheUpdate] clear cached table sql:", tableName)
	cacher.ClearIds(tableName)
	return nil
}

// Update records, bean's non-empty fields are updated contents,
// condiBean' non-empty filds are conditions
// CAUTION:
//        1.bool will defaultly be updated content nor conditions
//         You should call UseBool if you have bool to use.
//        2.float32 & float64 may be not inexact as conditions
func (session *Session) Update(bean interface{}, condiBean ...interface{}) (int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	t := rType(bean)

	var colNames []string
	var args []interface{}
	var table *core.Table

	// handle before update processors
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures) // cleanup after used
	if processor, ok := interface{}(bean).(BeforeUpdateProcessor); ok {
		processor.BeforeUpdate()
	}
	// --

	var err error
	if t.Kind() == reflect.Struct {
		table = session.Engine.TableInfo(bean)
		session.Statement.RefTable = table

		if session.Statement.ColumnStr == "" {
			colNames, args = buildUpdates(session.Engine, table, bean, false, false,
				false, false, session.Statement.allUseBool, session.Statement.useAllCols,
				session.Statement.mustColumnMap, session.Statement.columnMap, true)
		} else {
			colNames, args, err = genCols(table, session, bean, true, true)
			if err != nil {
				return 0, err
			}
		}
	} else if t.Kind() == reflect.Map {
		if session.Statement.RefTable == nil {
			return 0, ErrTableNotFound
		}
		table = session.Statement.RefTable
		colNames = make([]string, 0)
		args = make([]interface{}, 0)
		bValue := reflect.Indirect(reflect.ValueOf(bean))

		for _, v := range bValue.MapKeys() {
			colNames = append(colNames, session.Engine.Quote(v.String())+" = ?")
			args = append(args, bValue.MapIndex(v).Interface())
		}
	} else {
		return 0, ErrParamsType
	}

	if session.Statement.UseAutoTime && table.Updated != "" {
		colNames = append(colNames, session.Engine.Quote(table.Updated)+" = ?")
		col := table.UpdatedColumn()
		val, t := session.Engine.NowTime2(col.SQLType.Name)
		args = append(args, val)

		var colName = col.Name
		session.afterClosures = append(session.afterClosures, func(bean interface{}) {
			col := table.GetColumn(colName)
			setColumnTime(bean, col, t)
		})
	}

	//for update action to like "column = column + ?"
	incColumns := session.Statement.getInc()
	for _, v := range incColumns {
		colNames = append(colNames, session.Engine.Quote(v.colName)+" = "+session.Engine.Quote(v.colName)+" + ?")
		args = append(args, v.arg)
	}
	//for update action to like "column = column - ?"
	decColumns := session.Statement.getDec()
	for _, v := range decColumns {
		colNames = append(colNames, session.Engine.Quote(v.colName)+" = "+session.Engine.Quote(v.colName)+" - ?")
		args = append(args, v.arg)
	}
	//for update action to like "column = expression"
	exprColumns := session.Statement.getExpr()
	for _, v := range exprColumns {
		colNames = append(colNames, session.Engine.Quote(v.colName)+" = "+v.expr)
	}

	var condiColNames []string
	var condiArgs []interface{}

	if len(condiBean) > 0 {
		condiColNames, condiArgs = buildConditions(session.Engine, session.Statement.RefTable, condiBean[0], true, true,
			false, true, session.Statement.allUseBool, session.Statement.useAllCols,
			session.Statement.unscoped, session.Statement.mustColumnMap)
	}

	var condition = ""
	session.Statement.processIdParam()
	st := session.Statement
	defer session.resetStatement()
	if st.WhereStr != "" {
		condition = fmt.Sprintf("%v", st.WhereStr)
	}

	if condition == "" {
		if len(condiColNames) > 0 {
			condition = fmt.Sprintf("%v", strings.Join(condiColNames, " "+session.Engine.Dialect().AndStr()+" "))
		}
	} else {
		if len(condiColNames) > 0 {
			condition = fmt.Sprintf("(%v) %v (%v)", condition,
				session.Engine.Dialect().AndStr(), strings.Join(condiColNames, " "+session.Engine.Dialect().AndStr()+" "))
		}
	}

	var sqlStr, inSql string
	var inArgs []interface{}
	doIncVer := false
	var verValue *reflect.Value
	if table.Version != "" && session.Statement.checkVersion {
		if condition != "" {
			condition = fmt.Sprintf("WHERE (%v) %v %v = ?", condition, session.Engine.Dialect().AndStr(),
				session.Engine.Quote(table.Version))
		} else {
			condition = fmt.Sprintf("WHERE %v = ?", session.Engine.Quote(table.Version))
		}
		inSql, inArgs = session.Statement.genInSql()
		if len(inSql) > 0 {
			if condition != "" {
				condition += " " + session.Engine.Dialect().AndStr() + " " + inSql
			} else {
				condition = "WHERE " + inSql
			}
		}

		if st.LimitN > 0 {
			condition = condition + fmt.Sprintf(" LIMIT %d", st.LimitN)
		}

		sqlStr = fmt.Sprintf("UPDATE %v SET %v, %v %v",
			session.Engine.Quote(session.Statement.TableName()),
			strings.Join(colNames, ", "),
			session.Engine.Quote(table.Version)+" = "+session.Engine.Quote(table.Version)+" + 1",
			condition)

		verValue, err = table.VersionColumn().ValueOf(bean)
		if err != nil {
			return 0, err
		}

		condiArgs = append(condiArgs, verValue.Interface())
		doIncVer = true
	} else {
		if condition != "" {
			condition = "WHERE " + condition
		}
		inSql, inArgs = session.Statement.genInSql()
		if len(inSql) > 0 {
			if condition != "" {
				condition += " " + session.Engine.Dialect().AndStr() + " " + inSql
			} else {
				condition = "WHERE " + inSql
			}
		}

		if st.LimitN > 0 {
			condition = condition + fmt.Sprintf(" LIMIT %d", st.LimitN)
		}

		sqlStr = fmt.Sprintf("UPDATE %v SET %v %v",
			session.Engine.Quote(session.Statement.TableName()),
			strings.Join(colNames, ", "),
			condition)
	}

	args = append(args, st.Params...)
	args = append(args, inArgs...)
	args = append(args, condiArgs...)

	res, err := session.exec(sqlStr, args...)
	if err != nil {
		return 0, err
	} else if doIncVer {
		if verValue != nil && verValue.IsValid() && verValue.CanSet() {
			verValue.SetInt(verValue.Int() + 1)
		}
	}

	if cacher := session.Engine.getCacher2(table); cacher != nil && session.Statement.UseCache {
		cacher.ClearIds(session.Statement.TableName())
		cacher.ClearBeans(session.Statement.TableName())
	}

	// handle after update processors
	if session.IsAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := interface{}(bean).(AfterUpdateProcessor); ok {
			session.Engine.LogDebug("[event]", session.Statement.TableName(), " has after update processor")
			processor.AfterUpdate()
		}
	} else {
		lenAfterClosures := len(session.afterClosures)
		if lenAfterClosures > 0 {
			if value, has := session.afterUpdateBeans[bean]; has && value != nil {
				*value = append(*value, session.afterClosures...)
			} else {
				afterClosures := make([]func(interface{}), lenAfterClosures)
				copy(afterClosures, session.afterClosures)
				session.afterUpdateBeans[bean] = &afterClosures
			}

		} else {
			if _, ok := interface{}(bean).(AfterInsertProcessor); ok {
				session.afterUpdateBeans[bean] = nil
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures) // cleanup after used
	// --

	return res.RowsAffected()
}

func (session *Session) cacheDelete(sqlStr string, args ...interface{}) error {
	if session.Statement.RefTable == nil || len(session.Statement.RefTable.PrimaryKeys) != 1 {
		return ErrCacheFailed
	}

	for _, filter := range session.Engine.dialect.Filters() {
		sqlStr = filter.Do(sqlStr, session.Engine.dialect, session.Statement.RefTable)
	}

	newsql := session.Statement.convertIdSql(sqlStr)
	if newsql == "" {
		return ErrCacheFailed
	}

	cacher := session.Engine.getCacher2(session.Statement.RefTable)
	tableName := session.Statement.TableName()
	ids, err := core.GetCacheSql(cacher, tableName, newsql, args)
	if err != nil {
		resultsSlice, err := session.query(newsql, args...)
		if err != nil {
			return err
		}
		ids = make([]core.PK, 0)
		if len(resultsSlice) > 0 {
			for _, data := range resultsSlice {
				var id int64
				if v, ok := data[session.Statement.RefTable.PrimaryKeys[0]]; !ok {
					return errors.New("no id")
				} else {
					id, err = strconv.ParseInt(string(v), 10, 64)
					if err != nil {
						return err
					}
				}
				ids = append(ids, core.PK{id})
			}
		}
	} /*else {
	    session.Engine.LogDebug("delete cache sql %v", newsql)
	    cacher.DelIds(tableName, genSqlKey(newsql, args))
	}*/

	for _, id := range ids {
		session.Engine.LogDebug("[cacheDelete] delete cache obj", tableName, id)
		sid, err := id.ToString()
		if err != nil {
			return err
		}
		cacher.DelBean(tableName, sid)
	}
	session.Engine.LogDebug("[cacheDelete] clear cache sql", tableName)
	cacher.ClearIds(tableName)
	return nil
}

// Delete records, bean's non-empty fields are conditions
func (session *Session) Delete(bean interface{}) (int64, error) {
	defer session.resetStatement()
	if session.IsAutoClose {
		defer session.Close()
	}

	// handle before delete processors
	for _, closure := range session.beforeClosures {
		closure(bean)
	}
	cleanupProcessorsClosures(&session.beforeClosures)

	if processor, ok := interface{}(bean).(BeforeDeleteProcessor); ok {
		processor.BeforeDelete()
	}
	// --

	table := session.Engine.TableInfo(bean)
	session.Statement.RefTable = table
	colNames, args := buildConditions(session.Engine, table, bean, true, true,
		false, true, session.Statement.allUseBool, session.Statement.useAllCols,
		session.Statement.unscoped, session.Statement.mustColumnMap)

	var condition = ""
	var andStr = session.Engine.dialect.AndStr()

	session.Statement.processIdParam()
	if session.Statement.WhereStr != "" {
		condition = session.Statement.WhereStr
		if len(colNames) > 0 {
			condition += " " + andStr + " " + strings.Join(colNames, " "+andStr+" ")
		}
	} else {
		condition = strings.Join(colNames, " "+andStr+" ")
	}
	inSql, inArgs := session.Statement.genInSql()
	if len(inSql) > 0 {
		if len(condition) > 0 {
			condition += " " + andStr + " "
		}
		condition += inSql
		args = append(args, inArgs...)
	}
	if len(condition) == 0 {
		return 0, ErrNeedDeletedCond
	}

	sqlStr, sqlStrForCache := "", ""
	argsForCache := make([]interface{}, 0, len(args)*2)
	if session.Statement.unscoped || table.DeletedColumn() == nil { // tag "deleted" is disabled
		sqlStr = fmt.Sprintf("DELETE FROM %v WHERE %v",
			session.Engine.Quote(session.Statement.TableName()), condition)

		sqlStrForCache = sqlStr
		copy(argsForCache, args)
		argsForCache = append(session.Statement.Params, argsForCache...)
	} else {
		// !oinume! sqlStrForCache and argsForCache is needed to behave as executing "DELETE FROM ..." for cache.
		sqlStrForCache = fmt.Sprintf("DELETE FROM %v WHERE %v",
			session.Engine.Quote(session.Statement.TableName()), condition)
		copy(argsForCache, args)
		argsForCache = append(session.Statement.Params, argsForCache...)

		deletedColumn := table.DeletedColumn()
		sqlStr = fmt.Sprintf("UPDATE %v SET %v = ? WHERE %v",
			session.Engine.Quote(session.Statement.TableName()),
			session.Engine.Quote(deletedColumn.Name),
			condition)

		// !oinume! Insert NowTime to the head of session.Statement.Params
		session.Statement.Params = append(session.Statement.Params, "")
		paramsLen := len(session.Statement.Params)
		copy(session.Statement.Params[1:paramsLen], session.Statement.Params[0:paramsLen-1])

		val, t := session.Engine.NowTime2(deletedColumn.SQLType.Name)
		session.Statement.Params[0] = val

		var colName = deletedColumn.Name
		session.afterClosures = append(session.afterClosures, func(bean interface{}) {
			col := table.GetColumn(colName)
			setColumnTime(bean, col, t)
		})
	}

	args = append(session.Statement.Params, args...)

	if cacher := session.Engine.getCacher2(session.Statement.RefTable); cacher != nil && session.Statement.UseCache {
		session.cacheDelete(sqlStrForCache, argsForCache...)
	}

	res, err := session.exec(sqlStr, args...)
	if err != nil {
		return 0, err
	}

	// handle after delete processors
	if session.IsAutoCommit {
		for _, closure := range session.afterClosures {
			closure(bean)
		}
		if processor, ok := interface{}(bean).(AfterDeleteProcessor); ok {
			processor.AfterDelete()
		}
	} else {
		lenAfterClosures := len(session.afterClosures)
		if lenAfterClosures > 0 {
			if value, has := session.afterDeleteBeans[bean]; has && value != nil {
				*value = append(*value, session.afterClosures...)
			} else {
				afterClosures := make([]func(interface{}), lenAfterClosures)
				copy(afterClosures, session.afterClosures)
				session.afterDeleteBeans[bean] = &afterClosures
			}
		} else {
			if _, ok := interface{}(bean).(AfterInsertProcessor); ok {
				session.afterDeleteBeans[bean] = nil
			}
		}
	}
	cleanupProcessorsClosures(&session.afterClosures)
	// --

	return res.RowsAffected()
}

func (s *Session) Sync2(beans ...interface{}) error {
	engine := s.Engine

	tables, err := engine.DBMetas()
	if err != nil {
		return err
	}

	structTables := make([]*core.Table, 0)

	for _, bean := range beans {
		table := engine.TableInfo(bean)
		structTables = append(structTables, table)

		var oriTable *core.Table
		for _, tb := range tables {
			if tb.Name == table.Name {
				oriTable = tb
				break
			}
		}

		if oriTable == nil {
			err = engine.StoreEngine(s.Statement.StoreEngine).CreateTable(bean)
			if err != nil {
				return err
			}

			err = engine.CreateUniques(bean)
			if err != nil {
				return err
			}

			err = engine.CreateIndexes(bean)
			if err != nil {
				return err
			}
		} else {
			for _, col := range table.Columns() {
				var oriCol *core.Column
				for _, col2 := range oriTable.Columns() {
					if col.Name == col2.Name {
						oriCol = col2
						break
					}
				}

				if oriCol != nil {
					expectedType := engine.dialect.SqlType(col)
					curType := engine.dialect.SqlType(oriCol)
					if expectedType != curType {
						if expectedType == core.Text &&
							strings.HasPrefix(curType, core.Varchar) {
							// currently only support mysql & postgres
							if engine.dialect.DBType() == core.MYSQL ||
								engine.dialect.DBType() == core.POSTGRES {
								engine.LogInfof("Table %s column %s change type from %s to %s\n",
									table.Name, col.Name, curType, expectedType)
								_, err = engine.Exec(engine.dialect.ModifyColumnSql(table.Name, col))
							} else {
								engine.LogWarnf("Table %s column %s db type is %s, struct type is %s\n",
									table.Name, col.Name, curType, expectedType)
							}
						} else {
							engine.LogWarnf("Table %s column %s db type is %s, struct type is %s",
								table.Name, col.Name, curType, expectedType)
						}
					}
					if col.Default != oriCol.Default {
						engine.LogWarnf("Table %s Column %s db default is %s, struct default is %s",
							table.Name, col.Name, oriCol.Default, col.Default)
					}
					if col.Nullable != oriCol.Nullable {
						engine.LogWarnf("Table %s Column %s db nullable is %v, struct nullable is %v",
							table.Name, col.Name, oriCol.Nullable, col.Nullable)
					}
				} else {
					session := engine.NewSession()
					session.Statement.RefTable = table
					defer session.Close()
					err = session.addColumn(col.Name)
				}
				if err != nil {
					return err
				}
			}

			var foundIndexNames = make(map[string]bool)

			for name, index := range table.Indexes {
				var oriIndex *core.Index
				for name2, index2 := range oriTable.Indexes {
					if index.Equal(index2) {
						oriIndex = index2
						foundIndexNames[name2] = true
						break
					}
				}

				if oriIndex != nil {
					if oriIndex.Type != index.Type {
						sql := engine.dialect.DropIndexSql(table.Name, oriIndex)
						_, err = engine.Exec(sql)
						if err != nil {
							return err
						}
						oriIndex = nil
					}
				}

				if oriIndex == nil {
					if index.Type == core.UniqueType {
						session := engine.NewSession()
						session.Statement.RefTable = table
						defer session.Close()
						err = session.addUnique(table.Name, name)
					} else if index.Type == core.IndexType {
						session := engine.NewSession()
						session.Statement.RefTable = table
						defer session.Close()
						err = session.addIndex(table.Name, name)
					}
					if err != nil {
						return err
					}
				}
			}

			for name2, index2 := range oriTable.Indexes {
				if _, ok := foundIndexNames[name2]; !ok {
					sql := engine.dialect.DropIndexSql(table.Name, index2)
					_, err = engine.Exec(sql)
					if err != nil {
						return err
					}
				}
			}
		}
	}

	for _, table := range tables {
		var oriTable *core.Table
		for _, structTable := range structTables {
			if table.Name == structTable.Name {
				oriTable = structTable
				break
			}
		}

		if oriTable == nil {
			engine.LogWarnf("Table %s has no struct to mapping it", table.Name)
			continue
		}

		for _, colName := range table.ColumnsSeq() {
			if oriTable.GetColumn(colName) == nil {
				engine.LogWarnf("Table %s has column %s but struct has not related field",
					table.Name, colName)
			}
		}
	}
	return nil
}

// Always disable struct tag "deleted"
func (session *Session) Unscoped() *Session {
	session.Statement.Unscoped()
	return session
}
