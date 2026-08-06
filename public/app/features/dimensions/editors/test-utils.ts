import { type StandardEditorProps, type StandardEditorContext } from '@grafana/data';

export const makePropsFactory =
  <Config extends {}, Settings extends {}>(
    id: string,
    settings: StandardEditorProps<Config, Settings>['item']['settings'],
    context: StandardEditorContext<Config, Settings> = { data: [] }
  ) =>
  (
    value: Config,
    onChange = jest.fn()
  ): {
    props: StandardEditorProps<Config, Settings>;
    onChange: StandardEditorProps<Config, Settings>['onChange'];
  } => ({
    props: {
      value,
      onChange,
      context,
      item: { settings, id: 'item', name: 'Item' },
      id,
    },
    onChange,
  });
