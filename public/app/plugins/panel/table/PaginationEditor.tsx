import * as React from 'react';

import { StandardEditorProps } from '@grafana/data';
import { Switch } from '@grafana/ui';

export function PaginationEditor({ onChange, value, context, id }: StandardEditorProps<boolean>) {
  const changeValue = (event: React.FormEvent<HTMLInputElement> | undefined) => {
    if (event?.currentTarget.checked) {
      context.options.footer.show = false;
    }
    onChange(event?.currentTarget.checked);
  };

  return <Switch value={Boolean(value)} onChange={changeValue} id={id} />;
}
