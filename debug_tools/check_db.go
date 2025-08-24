package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
	_ "github.com/mattn/go-sqlite3" // SQLite driver
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run check_db.go <database_url>")
		fmt.Println("Examples:")
		fmt.Println("  go run check_db.go 'sqlite:///path/to/grafana.db'")
		fmt.Println("  go run check_db.go 'postgres://user:pass@localhost:5432/grafana'")
		os.Exit(1)
	}

	dbURL := os.Args[1]
	db, err := sql.Open(getDriver(dbURL), getDSN(dbURL))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	fmt.Println("=== Resource Permission Database Check ===")
	fmt.Println()

	// Check 1: Permission tables exist
	fmt.Println("1. Checking if permission tables exist...")
	checkPermissionTables(ctx, db)

	// Check 2: Roles table structure
	fmt.Println("\n2. Checking roles table structure...")
	checkRolesTable(ctx, db)

	// Check 3: Managed roles
	fmt.Println("\n3. Checking for managed roles...")
	checkManagedRoles(ctx, db)

	// Check 4: Permissions table structure
	fmt.Println("\n4. Checking permissions table structure...")
	checkPermissionsTable(ctx, db)

	// Check 5: Existing resource permissions
	fmt.Println("\n5. Checking for existing resource permissions...")
	checkExistingResourcePermissions(ctx, db)

	// Check 6: Recent permission insertions
	fmt.Println("\n6. Checking for recent permission insertions...")
	checkRecentPermissions(ctx, db)

	// Check 7: Admin users
	fmt.Println("\n7. Checking for admin users...")
	checkAdminUsers(ctx, db)

	// Check 8: Unified storage resource table
	fmt.Println("\n8. Checking for unified storage resource table...")
	checkResourceTable(ctx, db)

	// Check 9: Orphaned permissions
	fmt.Println("\n9. Checking for orphaned permissions...")
	checkOrphanedPermissions(ctx, db)

	fmt.Println("\n=== Database check completed ===")
}

func getDriver(dbURL string) string {
	if len(dbURL) > 7 && dbURL[:7] == "sqlite:" {
		return "sqlite3"
	}
	return "postgres"
}

func getDSN(dbURL string) string {
	if len(dbURL) > 7 && dbURL[:7] == "sqlite:" {
		return dbURL[7:]
	}
	return dbURL
}

func checkPermissionTables(ctx context.Context, db *sql.DB) {
	query := `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%permission%'`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		tables = append(tables, table)
	}

	if len(tables) == 0 {
		fmt.Println("  No permission tables found!")
	} else {
		fmt.Printf("  Found tables: %v\n", tables)
	}
}

func checkRolesTable(ctx context.Context, db *sql.DB) {
	query := `SELECT id, name, org_id, created FROM role LIMIT 5`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	fmt.Println("  Role table structure:")
	for rows.Next() {
		var id int64
		var name string
		var orgID int64
		var created time.Time
		if err := rows.Scan(&id, &name, &orgID, &created); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    ID: %d, Name: %s, OrgID: %d, Created: %s\n", id, name, orgID, created)
	}
}

func checkManagedRoles(ctx context.Context, db *sql.DB) {
	query := `SELECT id, name, org_id FROM role WHERE name LIKE 'managed:%' LIMIT 10`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var id int64
		var name string
		var orgID int64
		if err := rows.Scan(&id, &name, &orgID); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    ID: %d, Name: %s, OrgID: %d\n", id, name, orgID)
		count++
	}

	if count == 0 {
		fmt.Println("  No managed roles found")
	}
}

func checkPermissionsTable(ctx context.Context, db *sql.DB) {
	query := `SELECT id, role_id, action, scope, created FROM permission LIMIT 5`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	fmt.Println("  Permission table structure:")
	for rows.Next() {
		var id int64
		var roleID int64
		var action string
		var scope string
		var created time.Time
		if err := rows.Scan(&id, &roleID, &action, &scope, &created); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    ID: %d, RoleID: %d, Action: %s, Scope: %s, Created: %s\n", id, roleID, action, scope, created)
	}
}

func checkExistingResourcePermissions(ctx context.Context, db *sql.DB) {
	query := `
		SELECT p.id, p.action, p.scope, p.created, r.name as role_name, r.org_id
		FROM permission p
		INNER JOIN role r ON p.role_id = r.id
		WHERE p.scope LIKE '%resourcepermission%' OR p.scope LIKE '%iam%'
		LIMIT 10
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var id int64
		var action string
		var scope string
		var created time.Time
		var roleName string
		var orgID int64
		if err := rows.Scan(&id, &action, &scope, &created, &roleName, &orgID); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    ID: %d, Action: %s, Scope: %s, Role: %s, OrgID: %d, Created: %s\n", id, action, scope, roleName, orgID, created)
		count++
	}

	if count == 0 {
		fmt.Println("  No existing resource permissions found")
	}
}

func checkRecentPermissions(ctx context.Context, db *sql.DB) {
	query := `
		SELECT p.id, p.action, p.scope, p.created, r.name as role_name, r.org_id
		FROM permission p
		INNER JOIN role r ON p.role_id = r.id
		WHERE p.created >= NOW() - INTERVAL '1 day'
		ORDER BY p.created DESC
		LIMIT 10
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var id int64
		var action string
		var scope string
		var created time.Time
		var roleName string
		var orgID int64
		if err := rows.Scan(&id, &action, &scope, &created, &roleName, &orgID); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    ID: %d, Action: %s, Scope: %s, Role: %s, OrgID: %d, Created: %s\n", id, action, scope, roleName, orgID, created)
		count++
	}

	if count == 0 {
		fmt.Println("  No recent permission insertions found")
	}
}

func checkAdminUsers(ctx context.Context, db *sql.DB) {
	query := `
		SELECT u.id, u.login, u.email, u.is_grafana_admin, ur.role_id, r.name as role_name
		FROM "user" u
		LEFT JOIN user_role ur ON u.id = ur.user_id
		LEFT JOIN role r ON ur.role_id = r.id
		WHERE u.is_grafana_admin = true OR r.name LIKE '%admin%'
		LIMIT 10
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var id int64
		var login string
		var email string
		var isAdmin bool
		var roleID sql.NullInt64
		var roleName sql.NullString
		if err := rows.Scan(&id, &login, &email, &isAdmin, &roleID, &roleName); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    ID: %d, Login: %s, Email: %s, IsAdmin: %t, RoleID: %v, RoleName: %v\n", id, login, email, isAdmin, roleID, roleName)
		count++
	}

	if count == 0 {
		fmt.Println("  No admin users found")
	}
}

func checkResourceTable(ctx context.Context, db *sql.DB) {
	query := `SELECT table_name FROM information_schema.tables WHERE table_name = 'resource'`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}
	defer rows.Close()

	if rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("  Found resource table: %s\n", tableName)
		
		// Check for resource permission entries
		checkResourceEntries(ctx, db)
	} else {
		fmt.Println("  Resource table not found")
	}
}

func checkResourceEntries(ctx context.Context, db *sql.DB) {
	query := `SELECT "group", resource, name, created FROM resource WHERE "group" = 'iam.grafana.app' AND resource = 'resourcepermissions' LIMIT 10`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		fmt.Printf("  Error checking resource entries: %v\n", err)
		return
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var group string
		var resource string
		var name string
		var created time.Time
		if err := rows.Scan(&group, &resource, &name, &created); err != nil {
			fmt.Printf("  Error scanning: %v\n", err)
			return
		}
		fmt.Printf("    Group: %s, Resource: %s, Name: %s, Created: %s\n", group, resource, name, created)
		count++
	}

	if count == 0 {
		fmt.Println("  No resource permission entries found in resource table")
	}
}

func checkOrphanedPermissions(ctx context.Context, db *sql.DB) {
	query := `SELECT COUNT(*) as orphaned_permissions FROM permission p LEFT JOIN role r ON p.role_id = r.id WHERE r.id IS NULL`
	var count int64
	err := db.QueryRowContext(ctx, query).Scan(&count)
	if err != nil {
		fmt.Printf("  Error: %v\n", err)
		return
	}

	if count == 0 {
		fmt.Println("  No orphaned permissions found")
	} else {
		fmt.Printf("  Found %d orphaned permissions\n", count)
	}
}
