package main

type publishConfig struct {
	tag                       string
	srcBucket                 string
	destBucket                string
	enterprise2DestBucket     string
	enterprise2SecurityPrefix string
	staticAssetsBucket        string
	staticAssetEditions       []string
	storybookBucket           string
	security                  bool
}
