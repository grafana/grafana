import React, { useContext } from 'react';
import {
  FilterFramesByRefIdTransformerOptions,
  DataTransformerID,
  transformersRegistry,
  KeyValue,
} from '@grafana/data';
import { TransformerUIProps, TransformerUIRegistyItem } from './types';
import { ThemeContext } from '../../themes/ThemeContext';
import { css, cx } from 'emotion';
import { InlineList } from '../List/InlineList';

interface FilterByRefIdTransformerEditorProps extends TransformerUIProps<FilterFramesByRefIdTransformerOptions> {}

interface FilterByRefIdTransformerEditorState {
  include: string;
  options: RefIdInfo[];
  selected: string[];
}

interface RefIdInfo {
  refId: string;
  count: number;
}
export class FilterByRefIdTransformerEditor extends React.PureComponent<
  FilterByRefIdTransformerEditorProps,
  FilterByRefIdTransformerEditorState
> {
  constructor(props: FilterByRefIdTransformerEditorProps) {
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

    const allNames: RefIdInfo[] = [];
    const byName: KeyValue<RefIdInfo> = {};
    for (const frame of input) {
      if (frame.refId) {
        let v = byName[frame.refId];
        if (!v) {
          v = byName[frame.refId] = {
            refId: frame.refId,
            count: 0,
          };
          allNames.push(v);
        }
        v.count++;
      }
    }

    if (configuredOptions.length) {
      const options: RefIdInfo[] = [];
      const selected: RefIdInfo[] = [];
      for (const v of allNames) {
        if (configuredOptions.includes(v.refId)) {
          selected.push(v);
        }
        options.push(v);
      }

      this.setState({
        options,
        selected: selected.map(s => s.refId),
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
            const label = `${o.refId}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
            return (
              <span
                className={css`
                  margin-right: ${i === options.length - 1 ? '0' : '10px'};
                `}
              >
                <FilterPill
                  onClick={() => {
                    this.onFieldToggle(o.refId);
                  }}
                  label={label}
                  selected={selected.indexOf(o.refId) > -1}
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

export const filterFramesByRefIdTransformRegistryItem: TransformerUIRegistyItem<FilterFramesByRefIdTransformerOptions> = {
  id: DataTransformerID.filterByRefId,
  component: FilterByRefIdTransformerEditor,
  transformer: transformersRegistry.get(DataTransformerID.filterByRefId),
  name: 'Filter by refId',
  description: 'Filter results by refId',
};
