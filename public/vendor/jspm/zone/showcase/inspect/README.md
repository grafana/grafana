
## Inspect showcase

This showcase demonstrates what the _inspect_ tool does.

### What's in here

The directory contains two executable node programs.

  * `demo.js` spins up a TCP server. After that it creates a bunch of
    clients that send data to the server on an interval basis.
  * `inspect.js` delegates to the actual inspect tool which lives in
    the `/bin` directory.

### Running the showcase

  * Run `demo.js` it won't exit by itself.
  * In another terminal, run `inspect.js` to see
    a snapshot of the asynchronous action going on in demo.js.

### Purpose of the inspect tool

The inspect tool outputs a snapshot of all the asynchronous action
going on inside all node processes using zones. It also displays
resources (like sockets and file descriptors) that by themselves do not
represent future events, but are relevant to zones because these
resources are automatically cleaned up when the zone returns or throws.

The output looks like a tree, because zones act as containers for
asynchronous I/O and related resources.

Entries marked with a `+` are active sources of events that are running
inside the zone. Entries not marked with a plus sign are passive
resources that don't produce callbacks, but that are cleanup up when a
zone returns or throws.


### Output

The output should look similar to this:

```txt
> node inspect.js
(2194) node /Volumes/Aether/Users/kraman/Documents/strongloop/zone.kr/scratch.js
+[Zone        ] #1 Root (64 tasks, 4 external callbacks)
  +[ZoneCallback] #14 OnRead
  +[ZoneCallback] #15 OnWriteComplete
  +[ZoneCallback] #16 OnRead
  +[ZoneCallback] #17 OnWriteComplete
  +[Zone        ] #8 DebugServerZone (7 tasks, 5 external callbacks)
    +[ZoneCallback] #10 OnRead
    +[ZoneCallback] #11 OnWriteComplete
    +[ZoneCallback] #12 OnConnection
    +[ZoneCallback] #181 OnRead
    +[ZoneCallback] #182 OnWriteComplete
     [Stream      ] Pipe server 
     [Stream      ] Pipe handle 
   [Stream      ] TTY handle  (fd: 1)
   [Stream      ] TTY handle  (fd: 2)
  +[Zone        ] #18 ServerZone (23 tasks, 23 external callbacks)
    +[ZoneCallback] #20 OnRead
    +[ZoneCallback] #21 OnWriteComplete
    +[ZoneCallback] #22 OnConnection
     ...
     [Stream      ] TCP server  (:::3001)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53945)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53946)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53947)
     [Stream      ] TCP handle  (::ffff:127.0.0.1:3001 <=> ::ffff:127.0.0.1:53948)
     ...
  +[Zone        ] #23 ConnectionZone (3 tasks, 2 external callbacks)
    +[ZoneCallback] #27 OnRead
    +[ZoneCallback] #28 OnWriteComplete
     [Stream      ] TCP handle  (127.0.0.1:53945 <=> 127.0.0.1:3001)
    +[Zone        ] #153 IntervalZone (1 tasks, 1 external callbacks)
      +[ZoneCallback] #154 setInterval
  +[Zone        ] #31 ConnectionZone (3 tasks, 2 external callbacks)
    +[ZoneCallback] #35 OnRead
    +[ZoneCallback] #36 OnWriteComplete
     [Stream      ] TCP handle  (127.0.0.1:53946 <=> 127.0.0.1:3001)
    +[Zone        ] #155 IntervalZone (1 tasks, 1 external callbacks)
      +[ZoneCallback] #156 setInterval
  ...
```
