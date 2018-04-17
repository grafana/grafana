import _ from 'lodash';

/**
 * This function converts annotation events into set
 * of single events and regions (event consist of two)
 * @param annotations
 * @param options
 */
export function makeRegions(annotations, options) {
  let [regionEvents, singleEvents] = _.partition(annotations, 'regionId');
  let regions = getRegions(regionEvents, options.range);
  annotations = _.concat(regions, singleEvents);
  return annotations;
}

function getRegions(events, range) {
  let region_events = _.filter(events, event => {
    return event.regionId;
  });
  let regions = _.groupBy(region_events, 'regionId');
  regions = _.compact(
    _.map(regions, region_events => {
      let region_obj = _.head(region_events);
      if (region_events && region_events.length > 1) {
        region_obj.timeEnd = region_events[1].time;
        region_obj.isRegion = true;
        return region_obj;
      } else {
        if (region_events && region_events.length) {
          // Don't change proper region object
          if (!region_obj.time || !region_obj.timeEnd) {
            // This is cut region
            if (isStartOfRegion(region_obj)) {
              region_obj.timeEnd = range.to.valueOf() - 1;
            } else {
              // Start time = null
              region_obj.timeEnd = region_obj.time;
              region_obj.time = range.from.valueOf() + 1;
            }
            region_obj.isRegion = true;
          }

          return region_obj;
        }
      }
    })
  );

  return regions;
}

function isStartOfRegion(event): boolean {
  return event.id && event.id === event.regionId;
}

export function dedupAnnotations(annotations) {
  let dedup = [];

  // Split events by annotationId property existence
  let events = _.partition(annotations, 'id');

  let eventsById = _.groupBy(events[0], 'id');
  dedup = _.map(eventsById, eventGroup => {
    if (eventGroup.length > 1 && !_.every(eventGroup, isPanelAlert)) {
      // Get first non-panel alert
      return _.find(eventGroup, event => {
        return event.eventType !== 'panel-alert';
      });
    } else {
      return _.head(eventGroup);
    }
  });

  dedup = _.concat(dedup, events[1]);
  return dedup;
}

function isPanelAlert(event) {
  return event.eventType === 'panel-alert';
}
