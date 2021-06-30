package grafanats

type EventStream struct {
	Subject  string
	Name     string
	Replicas int
}

var eventStreams []EventStream

func init() {
	eventStreams = []EventStream{
		{
			Subject:  "datasource_changes",
			Name:     "datasource_changes",
			Replicas: 3,
		},
	}
}
