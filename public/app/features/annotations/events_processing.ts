import _ from 'lodash';

/**
 * This function converts annotation events into set
 * of single events and regions (event consist of two)
 * @param annotations
 * @param options
 */
export function makeRegions(annotations, options) {
  const [regionEvents, singleEvents] = _.partition(annotations, 'regionId');
  const regions = getRegions(regionEvents, options.range);
  annotations = _.concat(regions, singleEvents);
  return annotations;
}

function getRegions(events, range) {
  const regionEvents = _.filter(events, event => {
    return event.regionId;
  });
  let regions = _.groupBy(regionEvents, 'regionId');
  regions = _.compact(
    _.map(regions, regionEvents => {
      const regionObj = _.head(regionEvents);
      if (regionEvents && regionEvents.length > 1) {
        regionObj.timeEnd = regionEvents[1].time;
        regionObj.isRegion = true;
        return regionObj;
      } else {
        if (regionEvents && regionEvents.length) {
          // Don't change proper region object
          if (!regionObj.time || !regionObj.timeEnd) {
            // This is cut region
            if (isStartOfRegion(regionObj)) {
              regionObj.timeEnd = range.to.valueOf() - 1;
            } else {
              // Start time = null
              regionObj.timeEnd = regionObj.time;
              regionObj.time = range.from.valueOf() + 1;
            }
            regionObj.isRegion = true;
          }

          return regionObj;
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
  const events = _.partition(annotations, 'id');

  const eventsById = _.groupBy(events[0], 'id');
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
