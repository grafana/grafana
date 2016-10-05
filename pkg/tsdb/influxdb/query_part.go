package influxdb

type Selector interface {
	Render(input string) string
}
