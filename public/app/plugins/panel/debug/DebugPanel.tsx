import { useState } from 'react';

import { dateTime, type DateTime, type PanelProps } from '@grafana/data';
import { DateTimePicker, TimeOfDayPicker } from '@grafana/ui';

import { CursorView } from './CursorView';
import { EventBusLoggerPanel } from './EventBusLogger';
import { RenderInfoViewer } from './RenderInfoViewer';
import { StateView } from './StateView';
import { type Options, DebugMode } from './panelcfg.gen';

type Props = PanelProps<Options>;

export function DebugPanel(props: Props) {
  const { options } = props;

  const [date, setDate] = useState<DateTime | undefined>(dateTime(new Date()));

  return (
    <>
      <DateTimePicker
        label="Label"
        date={date}
        showSeconds={false}
        clearable={true}
        onChange={(newValue) => {
          setDate(newValue);
        }}
      />

      <TimeOfDayPicker allowEmpty={true} onChange={() => {}} />
    </>
  );

  switch (options.mode) {
    case DebugMode.Events:
      return <EventBusLoggerPanel eventBus={props.eventBus} />;
    case DebugMode.Cursor:
      return <CursorView eventBus={props.eventBus} />;
    case DebugMode.State:
      return <StateView {...props} />;
    case DebugMode.ThrowError:
      throw new Error('I failed you and for that i am deeply sorry');
    default:
      return <RenderInfoViewer {...props} />;
  }
}
