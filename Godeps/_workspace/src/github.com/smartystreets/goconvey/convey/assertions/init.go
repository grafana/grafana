package assertions

var serializer Serializer

func init() {
	serializer = newSerializer()
}
