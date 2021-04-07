package usagestats

type concurrentUsersStats struct {
	BucketLE3   int32 `xorm:"bucket_le_3"`
	BucketLE6   int32 `xorm:"bucket_le_6"`
	BucketLE9   int32 `xorm:"bucket_le_9"`
	BucketLE12  int32 `xorm:"bucket_le_12"`
	BucketLE15  int32 `xorm:"bucket_le_15"`
	BucketLEInf int32 `xorm:"bucket_le_inf"`
}
