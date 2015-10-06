package assertions

var (
	serializer Serializer = newSerializer()
	noop       Serializer = new(noopSerializer)
)
