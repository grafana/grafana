import sys
import math
import re
import random
import json
import time
import base64
from datetime import datetime
import urllib.request


def getRandomLogText():
    random_text = base64.b64encode(str(random.random()*1000).encode('utf8')).decode('utf8')
    maybe_ansi_text = 'with ANSI \u001B[31mpart of the text\u001B[0m' if random.random() < 0.5 else ''
    return f'log text {maybe_ansi_text} [{random_text}]'
# return json.dumps({
#     "line": f'log text {maybe_ansi_text} [{random_text}]',
#     "number": 42 if random.random() < 0.5 else 69,
# })

SLEEP_ANGLE_STEP = math.pi / 200
sleep_angle = 0
def get_next_sine_wave_sleep_duration():
    global sleep_angle
    sleep_angle += SLEEP_ANGLE_STEP
    return math.trunc(1000 * abs(math.sin(sleep_angle))) / 10000


def writeLogLine(timestamp, tags, text):
    # we write then in the influxdb line protocol format,
    # because that is what we configured in telegraf.
    # we could switch to something else too, whatever
    # is easiest to generate here and then read by telegraf.
		nano_timestamp = math.trunc(timestamp * 1000 * 1000 * 1000)
		tags_part = ','.join([f'{a}={b}' for (a,b) in tags.items()])
		escaped_text = text.replace('\\','\\\\').replace('"','\\"')
		line = f'log,{tags_part} line="{escaped_text}" {nano_timestamp}'
		print(line)
		sys.stdout.flush()

START_TIMESTAMP = datetime.utcnow().isoformat()

while True:
    time.sleep(get_next_sine_wave_sleep_duration())
    timestamp = time.time()
    text = getRandomLogText()
    tag_key = 'level'
    tag_value = random.choice(['info', 'error'])
    tags = {
        "level": random.choice([
            "info",
            "info",
            "error"
        ]),
        "__name__": "test1",
        "location": "moon",
        "protocol": "http",
        "start": START_TIMESTAMP,
    }
    tags_json = json.dumps(tags)
    writeLogLine(timestamp, tags, text)
