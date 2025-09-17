package bad

import (
	"fmt"
)

// Database represents a database dependency
type Database struct {
	connectionString string
}

// NewDatabase creates a new database instance
func NewDatabase(connStr string) *Database {
	return &Database{connectionString: connStr}
}

// Connect establishes a database connection
func (db *Database) Connect() error {
	fmt.Printf("Connecting to database: %s\n", db.connectionString)
	return nil
}

// Query executes a database query
func (db *Database) Query(sql string) ([]string, error) {
	fmt.Printf("Executing query: %s\n", sql)
	return []string{"result1", "result2"}, nil
}

// Logger represents a logging dependency
type Logger struct {
	level string
}

// NewLogger creates a new logger instance
func NewLogger(level string) *Logger {
	return &Logger{level: level}
}

// Log logs a message
func (logger *Logger) Log(message string) {
	fmt.Printf("[%s] %s\n", logger.level, message)
}

// UserService represents a service that depends on database and logger
type UserService struct {
	db     *Database
	logger *Logger
}

// NewUserService creates a new user service
func NewUserService(db *Database, logger *Logger) *UserService {
	return &UserService{db: db, logger: logger}
}

// GetUsers retrieves users from the database
func (us *UserService) GetUsers() ([]string, error) {
	us.logger.Log("Fetching users from database")
	return us.db.Query("SELECT * FROM users")
}

// Server represents the main application server
type Server struct {
	userService *UserService
	logger      *Logger
}

// NewServer creates a new server instance
func NewServer(userService *UserService, logger *Logger) *Server {
	return &Server{userService: userService, logger: logger}
}

// Start starts the server
func (server *Server) Start() error {
	server.logger.Log("Starting server")
	users, err := server.userService.GetUsers()
	if err != nil {
		return err
	}
	server.logger.Log(fmt.Sprintf("Found %d users", len(users)))
	return nil
}

// ProvideDatabase creates a database instance
func ProvideDatabase() *Database {
	return NewDatabase("postgres://localhost:5432/mydb")
}

// ProvideLogger creates a logger instance
func ProvideLogger() *Logger {
	return NewLogger("INFO")
}

// ProvideUserService creates a user service with dependencies
// This function calls methods on dependencies - should be detected by wire-checker
func ProvideUserService(db *Database, logger *Logger) *UserService {
	// This is a dependency call that should be detected
	db.Connect()

	// This is another dependency call that should be detected
	logger.Log("Initializing user service")

	return NewUserService(db, logger)
}

// ProvideServer creates a server with dependencies
// This function calls methods on dependencies - should be detected by wire-checker
func ProvideServer(userService *UserService, logger *Logger) *Server {
	// This is a dependency call that should be detected
	logger.Log("Creating server instance")

	// This is another dependency call that should be detected
	userService.GetUsers()

	return NewServer(userService, logger)
}
