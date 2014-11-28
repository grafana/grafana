/*
Package sqlite3 provides interface to SQLite3 databases.

This works as driver for database/sql.

Installation

    go get github.com/mattn/go-sqlite3

Supported Types

Currently, go-sqlite3 support following data types.

    +------------------------------+
    |go        | sqlite3           |
    |----------|-------------------|
    |nil       | null              |
    |int       | integer           |
    |int64     | integer           |
    |float64   | float             |
    |bool      | integer           |
    |[]byte    | blob              |
    |string    | text              |
    |time.Time | timestamp/datetime|
    +------------------------------+

SQLite3 Extension

You can write your own extension module for sqlite3. For example, below is a
extension for Regexp matcher operation.

    #include <pcre.h>
    #include <string.h>
    #include <stdio.h>
    #include <sqlite3ext.h>
    
    SQLITE_EXTENSION_INIT1
    static void regexp_func(sqlite3_context *context, int argc, sqlite3_value **argv) {
      if (argc >= 2) {
        const char *target  = (const char *)sqlite3_value_text(argv[1]);
        const char *pattern = (const char *)sqlite3_value_text(argv[0]);
        const char* errstr = NULL;
        int erroff = 0;
        int vec[500];
        int n, rc;
        pcre* re = pcre_compile(pattern, 0, &errstr, &erroff, NULL);
        rc = pcre_exec(re, NULL, target, strlen(target), 0, 0, vec, 500); 
        if (rc <= 0) {
          sqlite3_result_error(context, errstr, 0);
          return;
        }
        sqlite3_result_int(context, 1);
      }
    }
    
    #ifdef _WIN32
    __declspec(dllexport)
    #endif
    int sqlite3_extension_init(sqlite3 *db, char **errmsg,
          const sqlite3_api_routines *api) {
      SQLITE_EXTENSION_INIT2(api);
      return sqlite3_create_function(db, "regexp", 2, SQLITE_UTF8,
          (void*)db, regexp_func, NULL, NULL);
    }

It need to build as so/dll shared library. And you need to register
extension module like below.

	sql.Register("sqlite3_with_extensions",
		&sqlite3.SQLiteDriver{
			Extensions: []string{
				"sqlite3_mod_regexp",
			},
		})

Then, you can use this extension.

	rows, err := db.Query("select text from mytable where name regexp '^golang'")

Connection Hook

You can hook and inject your codes when connection established. database/sql
doesn't provide the way to get native go-sqlite3 interfaces. So if you want,
you need to hook ConnectHook and get the SQLiteConn.

	sql.Register("sqlite3_with_hook_example",
			&sqlite3.SQLiteDriver{
					ConnectHook: func(conn *sqlite3.SQLiteConn) error {
						sqlite3conn = append(sqlite3conn, conn)
						return nil
					},
			})

*/
package sqlite3
