package nsq_test

import (
	"flag"

	"github.com/nsqio/go-nsq"
)

func ExampleConfigFlag() {
	cfg := nsq.NewConfig()
	flagSet := flag.NewFlagSet("", flag.ExitOnError)

	flagSet.Var(&nsq.ConfigFlag{cfg}, "consumer-opt", "option to pass through to nsq.Consumer (may be given multiple times)")
	flagSet.PrintDefaults()

	err := flagSet.Parse([]string{
		"--consumer-opt=heartbeat_interval,1s",
		"--consumer-opt=max_attempts,10",
	})
	if err != nil {
		panic(err.Error())
	}
	println("HeartbeatInterval", cfg.HeartbeatInterval)
	println("MaxAttempts", cfg.MaxAttempts)
}
