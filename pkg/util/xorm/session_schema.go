// Copyright 2016 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"fmt"
	"strings"

	"xorm.io/core"
)

// Ping test if database is ok
func (session *Session) Ping() error {
	if session.isAutoClose {
		defer session.Close()
	}

	session.engine.logger.Infof("PING DATABASE %v", session.engine.DriverName())
	return session.DB().PingContext(session.ctx)
}

// CreateTable create a table according a bean
func (session *Session) CreateTable(bean interface{}) error {
	if session.isAutoClose {
		defer session.Close()
	}

	return session.createTable(bean)
}

func (session *Session) createTable(bean interface{}) error {
	if err := session.statement.setRefBean(bean); err != nil {
		return err
	}

	sqlStr := session.statement.genCreateTableSQL()
	_, err := session.exec(sqlStr)
	return err
}

// CreateIndexes create indexes
func (session *Session) CreateIndexes(bean interface{}) error {
	if session.isAutoClose {
		defer session.Close()
	}

	return session.createIndexes(bean)
}

func (session *Session) createIndexes(bean interface{}) error {
	if err := session.statement.setRefBean(bean); err != nil {
		return err
	}

	sqls := session.statement.genIndexSQL()
	for _, sqlStr := range sqls {
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

// CreateUniques create uniques
func (session *Session) CreateUniques(bean interface{}) error {
	if session.isAutoClose {
		defer session.Close()
	}
	return session.createUniques(bean)
}

func (session *Session) createUniques(bean interface{}) error {
	if err := session.statement.setRefBean(bean); err != nil {
		return err
	}

	sqls := session.statement.genUniqueSQL()
	for _, sqlStr := range sqls {
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

// DropIndexes drop indexes
func (session *Session) DropIndexes(bean interface{}) error {
	if session.isAutoClose {
		defer session.Close()
	}

	return session.dropIndexes(bean)
}

func (session *Session) dropIndexes(bean interface{}) error {
	if err := session.statement.setRefBean(bean); err != nil {
		return err
	}

	sqls := session.statement.genDelIndexSQL()
	for _, sqlStr := range sqls {
		_, err := session.exec(sqlStr)
		if err != nil {
			return err
		}
	}
	return nil
}

// DropTable drop table will drop table if exist, if drop failed, it will return error
func (session *Session) DropTable(beanOrTableName interface{}) error {
	if session.isAutoClose {
		defer session.Close()
	}

	return session.dropTable(beanOrTableName)
}

func (session *Session) dropTable(beanOrTableName interface{}) error {
	tableName := session.engine.TableName(beanOrTableName)
	var needDrop = true
	if !session.engine.dialect.SupportDropIfExists() {
		sqlStr, args := session.engine.dialect.TableCheckSql(tableName)
		results, err := session.queryBytes(sqlStr, args...)
		if err != nil {
			return err
		}
		needDrop = len(results) > 0
	}

	if needDrop {
		sqlStr := session.engine.Dialect().DropTableSql(session.engine.TableName(tableName, true))
		_, err := session.exec(sqlStr)
		return err
	}
	return nil
}

// IsTableExist if a table is exist
func (session *Session) IsTableExist(beanOrTableName interface{}) (bool, error) {
	if session.isAutoClose {
		defer session.Close()
	}

	tableName := session.engine.TableName(beanOrTableName)

	return session.isTableExist(tableName)
}

func (session *Session) isTableExist(tableName string) (bool, error) {
	sqlStr, args := session.engine.dialect.TableCheckSql(tableName)
	results, err := session.queryBytes(sqlStr, args...)
	return len(results) > 0, err
}

// IsTableEmpty if table have any records
func (session *Session) IsTableEmpty(bean interface{}) (bool, error) {
	if session.isAutoClose {
		defer session.Close()
	}
	return session.isTableEmpty(session.engine.TableName(bean))
}

func (session *Session) isTableEmpty(tableName string) (bool, error) {
	var total int64
	sqlStr := fmt.Sprintf("select count(*) from %s", session.engine.Quote(session.engine.TableName(tableName, true)))
	err := session.queryRow(sqlStr).Scan(&total)
	if err != nil {
		if err == sql.ErrNoRows {
			err = nil
		}
		return true, err
	}

	return total == 0, nil
}

// find if index is exist according cols
func (session *Session) isIndexExist2(tableName string, cols []string, unique bool) (bool, error) {
	indexes, err := session.engine.dialect.GetIndexes(tableName)
	if err != nil {
		return false, err
	}

	for _, index := range indexes {
		if sliceEq(index.Cols, cols) {
			if unique {
				return index.Type == core.UniqueType, nil
			}
			return index.Type == core.IndexType, nil
		}
	}
	return false, nil
}

func (session *Session) addColumn(colName string) error {
	col := session.statement.RefTable.GetColumn(colName)
	sql, args := session.statement.genAddColumnStr(col)
	_, err := session.exec(sql, args...)
	return err
}

func (session *Session) addIndex(tableName, idxName string) error {
	index := session.statement.RefTable.Indexes[idxName]
	sqlStr := session.engine.dialect.CreateIndexSql(tableName, index)
	_, err := session.exec(sqlStr)
	return err
}

func (session *Session) addUnique(tableName, uqeName string) error {
	index := session.statement.RefTable.Indexes[uqeName]
	sqlStr := session.engine.dialect.CreateIndexSql(tableName, index)
	_, err := session.exec(sqlStr)
	return err
}

// Sync2 synchronize structs to database tables
func (session *Session) Sync2(beans ...interface{}) error {
	engine := session.engine

	if session.isAutoClose {
		session.isAutoClose = false
		defer session.Close()
	}

	tables, err := engine.dialect.GetTables()
	if err != nil {
		return err
	}

	session.autoResetStatement = false
	defer func() {
		session.autoResetStatement = true
		session.resetStatement()
	}()

	for _, bean := range beans {
		v := rValue(bean)
		table, err := engine.mapType(v)
		if err != nil {
			return err
		}
		var tbName string
		if len(session.statement.AltTableName) > 0 {
			tbName = session.statement.AltTableName
		} else {
			tbName = engine.TableName(bean)
		}
		tbNameWithSchema := engine.tbNameWithSchema(tbName)

		var oriTable *core.Table
		for _, tb := range tables {
			if strings.EqualFold(engine.tbNameWithSchema(tb.Name), engine.tbNameWithSchema(tbName)) {
				oriTable = tb
				break
			}
		}

		// this is a new table
		if oriTable == nil {
			err = session.StoreEngine(session.statement.StoreEngine).createTable(bean)
			if err != nil {
				return err
			}

			err = session.createUniques(bean)
			if err != nil {
				return err
			}

			err = session.createIndexes(bean)
			if err != nil {
				return err
			}
			continue
		}

		// this will modify an old table
		if err = engine.loadTableInfo(oriTable); err != nil {
			return err
		}

		// check columns
		for _, col := range table.Columns() {
			var oriCol *core.Column
			for _, col2 := range oriTable.Columns() {
				if strings.EqualFold(col.Name, col2.Name) {
					oriCol = col2
					break
				}
			}

			// column is not exist on table
			if oriCol == nil {
				session.statement.RefTable = table
				session.statement.tableName = tbNameWithSchema
				if err = session.addColumn(col.Name); err != nil {
					return err
				}
				continue
			}

			err = nil
			expectedType := engine.dialect.SqlType(col)
			curType := engine.dialect.SqlType(oriCol)
			if expectedType != curType {
				if expectedType == core.Text &&
					strings.HasPrefix(curType, core.Varchar) {
					// currently only support mysql & postgres
					if engine.dialect.DBType() == core.MYSQL ||
						engine.dialect.DBType() == core.POSTGRES {
						engine.logger.Infof("Table %s column %s change type from %s to %s\n",
							tbNameWithSchema, col.Name, curType, expectedType)
						_, err = session.exec(engine.dialect.ModifyColumnSql(tbNameWithSchema, col))
					} else {
						engine.logger.Warnf("Table %s column %s db type is %s, struct type is %s\n",
							tbNameWithSchema, col.Name, curType, expectedType)
					}
				} else if strings.HasPrefix(curType, core.Varchar) && strings.HasPrefix(expectedType, core.Varchar) {
					if engine.dialect.DBType() == core.MYSQL {
						if oriCol.Length < col.Length {
							engine.logger.Infof("Table %s column %s change type from varchar(%d) to varchar(%d)\n",
								tbNameWithSchema, col.Name, oriCol.Length, col.Length)
							_, err = session.exec(engine.dialect.ModifyColumnSql(tbNameWithSchema, col))
						}
					}
				} else {
					if !(strings.HasPrefix(curType, expectedType) && curType[len(expectedType)] == '(') {
						engine.logger.Warnf("Table %s column %s db type is %s, struct type is %s",
							tbNameWithSchema, col.Name, curType, expectedType)
					}
				}
			} else if expectedType == core.Varchar {
				if engine.dialect.DBType() == core.MYSQL {
					if oriCol.Length < col.Length {
						engine.logger.Infof("Table %s column %s change type from varchar(%d) to varchar(%d)\n",
							tbNameWithSchema, col.Name, oriCol.Length, col.Length)
						_, err = session.exec(engine.dialect.ModifyColumnSql(tbNameWithSchema, col))
					}
				}
			}

			if col.Default != oriCol.Default {
				switch {
				case col.IsAutoIncrement: // For autoincrement column, don't check default
				case (col.SQLType.Name == core.Bool || col.SQLType.Name == core.Boolean) &&
					((strings.EqualFold(col.Default, "true") && oriCol.Default == "1") ||
						(strings.EqualFold(col.Default, "false") && oriCol.Default == "0")):
				default:
					engine.logger.Warnf("Table %s Column %s db default is %s, struct default is %s",
						tbName, col.Name, oriCol.Default, col.Default)
				}
			}
			if col.Nullable != oriCol.Nullable {
				engine.logger.Warnf("Table %s Column %s db nullable is %v, struct nullable is %v",
					tbName, col.Name, oriCol.Nullable, col.Nullable)
			}

			if err != nil {
				return err
			}
		}

		var foundIndexNames = make(map[string]bool)
		var addedNames = make(map[string]*core.Index)

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
					sql := engine.dialect.DropIndexSql(tbNameWithSchema, oriIndex)
					_, err = session.exec(sql)
					if err != nil {
						return err
					}
					oriIndex = nil
				}
			}

			if oriIndex == nil {
				addedNames[name] = index
			}
		}

		for name2, index2 := range oriTable.Indexes {
			if _, ok := foundIndexNames[name2]; !ok {
				sql := engine.dialect.DropIndexSql(tbNameWithSchema, index2)
				_, err = session.exec(sql)
				if err != nil {
					return err
				}
			}
		}

		for name, index := range addedNames {
			if index.Type == core.UniqueType {
				session.statement.RefTable = table
				session.statement.tableName = tbNameWithSchema
				err = session.addUnique(tbNameWithSchema, name)
			} else if index.Type == core.IndexType {
				session.statement.RefTable = table
				session.statement.tableName = tbNameWithSchema
				err = session.addIndex(tbNameWithSchema, name)
			}
			if err != nil {
				return err
			}
		}

		// check all the columns which removed from struct fields but left on database tables.
		for _, colName := range oriTable.ColumnsSeq() {
			if table.GetColumn(colName) == nil {
				engine.logger.Warnf("Table %s has column %s but struct has not related field", engine.TableName(oriTable.Name, true), colName)
			}
		}
	}

	return nil
}
