package resourceclient

import (
	"github.com/bwmarrin/snowflake"
)

// snowflakeRVThreshold separates snowflake RVs (new) from legacy microsecond-timestamp
// RVs (old). The two encodings occupy disjoint numeric bands for any realistic resource
// timestamp: a snowflake is (ms_since_2010_epoch << 22), so its <<22 shift lifts it ~150x
// above the microsecond form of the same instant. For resources dated 2013–2030, micro-RVs
// span ~1.4e15–1.9e15 while snowflakes span ~2.9e17–2.5e18, leaving an empty gap between them.
//
// The cut sits in that gap. 1e17 as a UnixMicros timestamp is year ~5138, so no real
// micro-RV reaches it; the smallest snowflake we can emit is ~1e16 (epoch + a few days),
// and any snowflake from a post-2011 timestamp is well above 1e17.
const snowflakeRVThreshold = int64(1e17)

// IsSnowflake returns whether the argument is a snowflake ID (new) or a microsecond
// timestamp (old).
func IsSnowflake(rv int64) bool {
	return rv >= snowflakeRVThreshold
}

// takes a unix microsecond RV and transforms into a snowflake format. The timestamp is converted from microsecond to
// millisecond (the integer division) and the remainder is saved in the stepbits section. machine id is always 0
func SnowflakeFromRV(rv int64) int64 {
	return (((rv / 1000) - snowflake.Epoch) << (snowflake.NodeBits + snowflake.StepBits)) + (rv % 1000)
}
