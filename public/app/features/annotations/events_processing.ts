import _ from 'lodash';

export function dedupAnnotations(annotations: any) {
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

function isPanelAlert(event: { eventType: string }) {
  return event.eventType === 'panel-alert';
}
