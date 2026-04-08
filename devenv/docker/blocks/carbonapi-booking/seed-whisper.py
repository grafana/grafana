"""
Pre-seed whisper files so go-carbon's carbonserver index is non-empty on startup.
go-carbon returns HTTP 500 for find queries on an empty index, which
bookingcom/carbonapi propagates as 422 rather than treating as "not found".
"""
import struct, os

def write_wsp(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        # Whisper header: aggregation=average(1), maxRetention=86400s, xff=0.5, archives=1
        f.write(struct.pack(">LLfL", 1, 86400, 0.5, 1))
        # Archive 0: offset=28, 60s/pt, 1440 points
        f.write(struct.pack(">LLL", 28, 60, 1440))
        f.write(b"\x00" * (1440 * 12))

# test.integration is used by the go-carbon healthcheck (query=test.*)
write_wsp("/var/lib/go-carbon/whisper/test/integration.wsp")
# grafanatest is used by the integration test suite
write_wsp("/var/lib/go-carbon/whisper/grafanatest.wsp")
