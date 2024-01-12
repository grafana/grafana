import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';

export function getPrettyJSON(obj: unknown): string {
  let r = '';
  try {
    r = JSON.stringify(obj, getCircularReplacer(), 2);
  } catch (e) {
    if (
      e instanceof Error &&
      (e.toString().includes('RangeError') || e.toString().includes('allocation size overflow'))
    ) {
      appEvents.emit(AppEvents.alertError, [e.toString(), 'Cannot display JSON, the object is too big.']);
    } else {
      appEvents.emit(AppEvents.alertError, [e instanceof Error ? e.toString() : e]);
    }
  }
  return r;
}

function getCircularReplacer() {
  const seen = new WeakSet();

  return (key: string, value: unknown) => {
    if (key === '__dataContext' || key === '__sceneObject') {
      return 'Filtered out in JSON serialization';
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}
