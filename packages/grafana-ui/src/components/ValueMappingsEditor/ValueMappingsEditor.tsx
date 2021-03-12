import React, { PureComponent, useCallback, useMemo } from 'react';
import { MappingType, ValueMapping, GrafanaTheme, ValueMap, RangeMap } from '@grafana/data';
import {
  DragDropContext,
  Draggable,
  DraggableProvidedDragHandleProps,
  Droppable,
  DropResult,
} from 'react-beautiful-dnd';
import { css, cx } from 'emotion';
import { stylesFactory, useStyles } from '../../themes';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Button } from '../Button';
import { ValueMapRow } from './ValueMappingRow';
import { RangeMapRow } from './RangeMappingRow';
import { VerticalGroup } from '../Layout/Layout';
import { DraggableMappingRow } from './DraggableMappingRow';

export interface Props {
  value: ValueMapping[];
  onChange: (valueMappings: ValueMapping[]) => void;
}

interface DraggableMappingProps {
  mapping: ValueMapping;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
  onRemove: (index: number) => void;
}

const DraggableMapping: React.FC<DraggableMappingProps> = ({ mapping, index, onChange, onRemove }) => {
  const styles = useStyles(getStyles);

  const displayInput = useMemo(
    () => (
      <Input
        className={styles.displayInput}
        defaultValue={mapping.text || ''}
        onBlur={(event) => {
          onChange(index, { ...mapping, text: event.currentTarget.value });
        }}
        prefix={'Display'}
      />
    ),
    [onChange, mapping, index, styles]
  );

  const removeButton = useMemo(
    () => (
      <IconButton
        size="sm"
        name="times"
        surface="dashboard"
        onClick={() => onRemove(index)}
        className={styles.removeButton}
      />
    ),
    [onRemove, styles, index]
  );

  const renderMapping = useCallback(
    (mappingRow: React.ReactNode, dragHandleProps: DraggableProvidedDragHandleProps, label: string) => (
      <div className={styles.handleWrap}>
        <DraggableMappingRow label={label} {...dragHandleProps} />

        <VerticalGroup spacing={'xs'} width="100%">
          {mappingRow}
          {displayInput}
        </VerticalGroup>
      </div>
    ),
    [styles, displayInput]
  );

  return (
    <Draggable draggableId={`mapping-${index}`} index={index}>
      {(provided) => (
        <div
          className={cx('gf-form-inline', styles.row)}
          ref={provided.innerRef}
          {...provided.draggableProps}
          tabIndex={0}
        >
          <div className={styles.rowWrap}>
            {mapping.type === MappingType.ValueToText &&
              renderMapping(
                <ValueMapRow mapping={(mapping as unknown) as ValueMap} index={index} onChange={onChange} />,
                provided.dragHandleProps!,
                'Value'
              )}

            {mapping.type === MappingType.RangeToText &&
              renderMapping(
                <RangeMapRow mapping={(mapping as unknown) as RangeMap} index={index} onChange={onChange} />,
                provided.dragHandleProps!,
                'Range'
              )}
            {removeButton}
          </div>
        </div>
      )}
    </Draggable>
  );
};

interface State {
  ts: number;
}

export class ValueMappingsEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      ts: Date.now(),
    };
  }

  componentDidUpdate(props: Props) {
    if (this.props.value !== props.value) {
      this.setState({ ts: Date.now() });
    }
  }

  onAddValue = () => {
    const { value, onChange } = this.props;
    const id = value && value.length > 0 ? Math.max(...value.map((v) => v.id)) + 1 : 0;

    onChange([
      ...value,
      {
        id,
        type: MappingType.ValueToText,
        value: '',
        text: '',
      },
    ]);
  };

  onAddRange = () => {
    const { value, onChange } = this.props;
    const id = value && value.length > 0 ? Math.max(...value.map((v) => v.id)) + 1 : 0;

    onChange([
      ...value,
      {
        id,
        type: MappingType.RangeToText,
        from: '',
        to: '',
        text: '',
      },
    ]);
  };

  onDragEnd = (result: DropResult) => {
    const { value } = this.props;
    if (!value || !result.destination) {
      return;
    }
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;

    const copy = [...value];
    const element = copy[fromIndex];
    copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, element);
    copy.forEach((v, idx) => {
      v.id = idx; // update the ids
    });
    this.props.onChange(copy);
  };

  onChange = (index: number, mapping: ValueMapping) => {
    const values = [...this.props.value];
    values[index] = mapping;
    this.props.onChange(values);
  };

  onRemove = (index: number) => {
    const values = [...this.props.value];
    values.splice(index, 1);
    this.props.onChange(values);
  };

  render() {
    const { value } = this.props;
    const { ts } = this.state;

    return (
      <div>
        {value && (
          <DragDropContext onDragEnd={this.onDragEnd}>
            <Droppable droppableId="sortable-field-mappings" direction="vertical">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {value.map((mapping, index) => {
                    return (
                      <DraggableMapping
                        mapping={mapping}
                        index={index}
                        onChange={this.onChange}
                        onRemove={this.onRemove}
                        key={`${index}/${ts}`}
                      />
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        <br />
        <Button
          size="sm"
          icon="plus"
          onClick={this.onAddValue}
          aria-label="ValueMappingsEditor add value button"
          variant="secondary"
        >
          Add value mapping
        </Button>
        &nbsp;
        <Button
          size="sm"
          icon="plus"
          onClick={this.onAddRange}
          aria-label="ValueMappingsEditor add range button"
          variant="secondary"
        >
          Add range mapping
        </Button>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme?: GrafanaTheme) => ({
  row: css`
    margin-bottom: ${theme?.spacing.md};
  `,
  removeButton: css`
    margin-top: 9px;
  `,
  displayInput: css`
    width: 100%;
    max-width: 200px;
  `,
  rowWrap: css`
    display: flex;
    justify-content: space-between;
    flex-grow: 1;
  `,
  handleWrap: css`
    display: flex;
    flex-grow: 1;
    width: 100%;
  `,

  // trying to get a 50% split that stacks when not enough space
  splitWrap: css`
    border: 1px solid red;
    width: 100%;
    display: flex;
  `,
  splitLeft: css`
    border: 1px solid green;
    flex: 1;
    min-width: 100px;
    flex-basis: auto;
  `,
  splitRight: css`
    border: 1px solid blue;
    flex: 1;
  `,
}));
