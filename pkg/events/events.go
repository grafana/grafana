package events

// Events can be passed to external systems via for example AMPQ
// Treat these events as basically DTOs so changes has to be backward compatible

type AccountCreated struct {
	Name string `json:"name"`
}
