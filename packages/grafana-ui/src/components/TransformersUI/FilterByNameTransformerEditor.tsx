import React, { useContext } from 'react';
import { FilterFieldsByNameTransformerOptions, DataTransformerID, transformersRegistry, KeyValue } from '@grafana/data';
import { TransformerUIProps, TransformerUIRegistyItem } from './types';
import { ThemeContext } from '../../themes/ThemeContext';
import { css, cx } from 'emotion';
import { InlineList } from '../List/InlineList';

interface FilterByNameTransformerEditorProps extends TransformerUIProps<FilterFieldsByNameTransformerOptions> {}

interface FilterByNameTransformerEditorState {
  include: string;
  options: FieldNameInfo[];
  selected: string[];
}

interface FieldNameInfo {
  name: string;
  count: number;
}
export class FilterByNameTransformerEditor extends React.PureComponent<
  FilterByNameTransformerEditorProps,
  FilterByNameTransformerEditorState
> {
  constructor(props: FilterByNameTransformerEditorProps) {
    super(props);
    this.state = {
      include: props.options.include || '',
      options: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  private initOptions() {
    const { input, options } = this.props;
    const configuredOptions = options.include ? options.include.split('|') : [];

    const allNames: FieldNameInfo[] = [];
    const byName: KeyValue<FieldNameInfo> = {};
    for (const frame of input) {
      for (const field of frame.fields) {
        let v = byName[field.name];
        if (!v) {
          v = byName[field.name] = {
            name: field.name,
            count: 0,
          };
          allNames.push(v);
        }
        v.count++;
      }
    }

    if (configuredOptions.length) {
      const options: FieldNameInfo[] = [];
      const selected: FieldNameInfo[] = [];
      for (const v of allNames) {
        if (configuredOptions.includes(v.name)) {
          selected.push(v);
        }
        options.push(v);
      }

      this.setState({
        options,
        selected: selected.map(s => s.name),
      });
    } else {
      this.setState({ options: allNames, selected: [] });
    }
  }

  onFieldToggle = (fieldName: string) => {
    const { selected } = this.state;
    if (selected.indexOf(fieldName) > -1) {
      this.onChange(selected.filter(s => s !== fieldName));
    } else {
      this.onChange([...selected, fieldName]);
    }
  };

  onChange = (selected: string[]) => {
    this.setState({ selected });
    this.props.onChange({
      ...this.props.options,
      include: selected.join('|'),
    });
  };

  render() {
    const { options, selected } = this.state;
    return (
      <>
        <InlineList
          items={options}
          renderItem={(o, i) => {
            const label = `${o.name}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
            return (
              <span
                className={css`
                  margin-right: ${i === options.length - 1 ? '0' : '10px'};
                `}
              >
                <FilterPill
                  onClick={() => {
                    this.onFieldToggle(o.name);
                  }}
                  label={label}
                  selected={selected.indexOf(o.name) > -1}
                />
              </span>
            );
          }}
        />
      </>
    );
  }
}

interface FilterPillProps {
  selected: boolean;
  label: string;
  onClick: React.MouseEventHandler<HTMLElement>;
}
const FilterPill: React.FC<FilterPillProps> = ({ label, selected, onClick }) => {
  const theme = useContext(ThemeContext);
  return (
    <div
      className={css`
        padding: ${theme.spacing.xxs} ${theme.spacing.sm};
        color: white;
        background: ${selected ? theme.colors.blueLight : theme.colors.blueShade};
        border-radius: 16px;
        display: inline-block;
        cursor: pointer;
      `}
      onClick={onClick}
    >
      {selected && (
        <i
          className={cx(
            'fa fa-check',
            css`
              margin-right: 4px;
            `
          )}
        />
      )}
      {label}
    </div>
  );
};

export const filterFieldsByNameTransformRegistryItem: TransformerUIRegistyItem<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.filterFieldsByName,
  component: FilterByNameTransformerEditor,
  transformer: transformersRegistry.get(DataTransformerID.filterFieldsByName),
  name: 'Filter by name',
  description: 'UI for filter by name transformation',
};
