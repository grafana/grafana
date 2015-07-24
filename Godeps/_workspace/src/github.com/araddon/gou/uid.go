package gou

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"strconv"
	"sync/atomic"
	"time"
)

const (
	//2013-2-3
	ourEpoch = uint32(1359931242)
)

func init() {
	initHostPidId()
}

/*
Special thanks to ideas from Mgo, and Noeqd, this is somewhat inbetween them
https://github.com/bmizerany/noeqd

It is a roughly sortable UID, but uses machine specific info (host, processid)
as part of the uid so each machine *will* have unique id's

The host+processid is 3 bytes

*/

// uidCounter is an atomically incremented each time we created
// a new uid within given ms time window
var uidCounter uint32 = 0

// hostPidId stores the generated hostPid
var hostPidId []byte

// initHostPidId generates a machine-process specific id by using hostname
// and processid
func initHostPidId() {
	var sum [4]byte
	hostB := sum[:]
	host, err := os.Hostname()
	if err != nil {
		// if we cannot get hostname, just use a random set of bytes
		_, err2 := io.ReadFull(rand.Reader, hostB)
		if err2 != nil {
			panic(fmt.Errorf("cannot get hostname: %v; %v", err, err2))
		}
	} else {
		hw := md5.New()
		hw.Write([]byte(host))
		copy(hostB, hw.Sum(nil))
	}
	pid := os.Getpid()
	hostI := binary.BigEndian.Uint32(hostB)
	uid := uint32(pid) + uint32(hostI)
	binary.BigEndian.PutUint32(hostB, uid)
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, uid)
	hostPidId = b[:]
}

// uid is a 64 bit int uid
type Uid uint64

// Create a new uint64 unique id
func NewUid() uint64 {
	b := make([]byte, 8)
	ts := uint32(time.Now().Unix()) - ourEpoch

	// Timestamp, 4 bytes, big endian
	binary.BigEndian.PutUint32(b, ts)
	//Debugf("ts=%v   b=%v", ts, b)
	// first 3 bytes of host/pid
	b[4] = hostPidId[2]
	b[5] = hostPidId[3]
	b[6] = hostPidId[3]
	// Increment, 2 bytes, big endian
	i := atomic.AddUint32(&uidCounter, 1)
	//b[6] = byte(i >> 8)
	b[7] = byte(i)
	ui := binary.BigEndian.Uint64(b)
	//Debugf("ui=%d  b=%v ", ui, b)
	return ui
}

func (u *Uid) String() string {
	return strconv.FormatUint(uint64(*u), 10)
}
