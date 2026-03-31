"""
Create a minimal seed whisper file so go-carbon's carbonserver has at least
one metric in its index on startup.  Without this, go-carbon returns HTTP 500
for find queries on an empty index, which bookingcom/carbonapi propagates as
HTTP 422 (Unprocessable Entity) rather than treating it as "not found".
"""
import struct, os

os.makedirs("/var/lib/go-carbon/whisper/test", exist_ok=True)
with open("/var/lib/go-carbon/whisper/test/integration.wsp", "wb") as f:
    # Whisper header: aggregation=average(1), maxRetention=86400s, xff=0.5, archives=1
    f.write(struct.pack(">LLfL", 1, 86400, 0.5, 1))
    # Archive 0: data at byte 28 (16 header + 12 archive-info), 60s/pt, 1440 points
    f.write(struct.pack(">LLL", 28, 60, 1440))
    # 1440 empty data points (timestamp=0, value=0.0)
    f.write(b"\x00" * (1440 * 12))
