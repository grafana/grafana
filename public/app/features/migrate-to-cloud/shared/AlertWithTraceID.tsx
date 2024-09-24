import { isFetchError } from '@grafana/runtime';
import { Alert, Stack, Text } from '@grafana/ui';
import { Props as AlertProps } from '@grafana/ui/src/components/Alert/Alert';

interface AlertWithTraceIDProps extends AlertProps {
  error?: unknown;
}

export function AlertWithTraceID(props: AlertWithTraceIDProps) {
  const { error, children, ...rest } = props;
  const traceID = maybeGetTraceID(error);

  return (
    <Alert {...rest}>
      <Stack direction="column" gap={1}>
        {children}

        {traceID && (
          /* Deliberately don't want to translate 'Trace ID' */
          /* eslint-disable-next-line @grafana/no-untranslated-strings */
          <Text element="p" color="secondary" variant="bodySmall">
            Trace ID: {traceID}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}

function maybeGetTraceID(err: unknown) {
  const data = isFetchError<unknown>(err) ? err.data : err;

  if (typeof data === 'object' && data && 'traceID' in data && typeof data.traceID === 'string') {
    return data.traceID;
  }

  return undefined;
}
