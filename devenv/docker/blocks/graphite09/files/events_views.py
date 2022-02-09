import datetime
import time

from django.utils.timezone import get_current_timezone
from django.core.urlresolvers import get_script_prefix
from django.http import HttpResponse
from django.shortcuts import render_to_response, get_object_or_404
from pytz import timezone

from graphite.util import json
from graphite.events import models
from graphite.render.attime import parseATTime


def to_timestamp(dt):
    return time.mktime(dt.timetuple())


class EventEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return to_timestamp(obj)
        return json.JSONEncoder.default(self, obj)


def view_events(request):
    if request.method == "GET":
        context = { 'events' : fetch(request),
            'slash' : get_script_prefix()
        }
        return render_to_response("events.html", context)
    else:
        return post_event(request)

def detail(request, event_id):
    e = get_object_or_404(models.Event, pk=event_id)
    context = { 'event' : e,
       'slash' : get_script_prefix()
    }
    return render_to_response("event.html", context)


def post_event(request):
    if request.method == 'POST':
        event = json.loads(request.body)
        assert isinstance(event, dict)

        values = {}
        values["what"] = event["what"]
        values["tags"] = event.get("tags", None)
        values["when"] = datetime.datetime.fromtimestamp(
            event.get("when", time.time()))
        if "data" in event:
            values["data"] = event["data"]

        e = models.Event(**values)
        e.save()

        return HttpResponse(status=200)
    else:
        return HttpResponse(status=405)

def get_data(request):
    if 'jsonp' in request.REQUEST:
        response = HttpResponse(
          "%s(%s)" % (request.REQUEST.get('jsonp'),
              json.dumps(fetch(request), cls=EventEncoder)),
          mimetype='text/javascript')
    else:
        response = HttpResponse(
            json.dumps(fetch(request), cls=EventEncoder),
            mimetype="application/json")
    return response

def fetch(request):
    #XXX we need to move to USE_TZ=True to get rid of naive-time conversions
    def make_naive(dt):
      if 'tz' in request.GET:
        tz = timezone(request.GET['tz'])
      else:
        tz = get_current_timezone()
      local_dt = dt.astimezone(tz)
      if hasattr(local_dt, 'normalize'):
        local_dt = local_dt.normalize()
      return local_dt.replace(tzinfo=None)

    if request.GET.get("from", None) is not None:
        time_from = make_naive(parseATTime(request.GET["from"]))
    else:
        time_from = datetime.datetime.fromtimestamp(0)

    if request.GET.get("until", None) is not None:
        time_until = make_naive(parseATTime(request.GET["until"]))
    else:
        time_until = datetime.datetime.now()

    tags = request.GET.get("tags", None)
    if tags is not None:
        tags = request.GET.get("tags").split(" ")

    return [x.as_dict() for x in
            models.Event.find_events(time_from, time_until, tags=tags)]
