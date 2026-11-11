package contracts

type Snowflake interface {
	Generate() int64
}
