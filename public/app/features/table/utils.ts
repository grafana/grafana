import {
  type ActionModel,
  type DataFrame,
  DataTransformerID,
  type Field,
  type FieldConfigSource,
  FieldMatcherID,
  type InterpolateFunction,
} from '@grafana/data';
import { type OrganizeFieldsTransformerOptions } from '@grafana/data/internal';
import { type DataTransformerConfig, type MatcherScope } from '@grafana/schema';
import { type TableSortByFieldState } from '@grafana/ui/internal';
import { getActions } from 'app/features/actions/utils';

/**
 * Returns the index of the frame to display, clamped to the range of available frames.
 */
export function getCurrentFrameIndex(frames: DataFrame[], options: { frameIndex: number }) {
  return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
}

/**
 * Persists a column width change as a `custom.width` field override, matched by field display name
 * and matcher scope. An unscoped override is treated as implicitly 'series'.
 */
export function onColumnResize(
  fieldDisplayName: string,
  width: number,
  fieldScope: MatcherScope = 'series',
  props: { fieldConfig: FieldConfigSource; onFieldConfigChange: (fieldConfig: FieldConfigSource) => void }
) {
  const { fieldConfig } = props;
  const { overrides } = fieldConfig;

  const matcherId = FieldMatcherID.byName;
  const propId = 'custom.width';

  // look for existing override. an unscoped override is treated as implicitly 'series'.
  const override = overrides.find(
    (o) =>
      o.matcher.id === matcherId &&
      o.matcher.options === fieldDisplayName &&
      (o.matcher.scope ?? 'series') === fieldScope
  );

  if (override) {
    // look for existing property
    const property = override.properties.find((prop) => prop.id === propId);
    if (property) {
      property.value = width;
    } else {
      override.properties.push({ id: propId, value: width });
    }
  } else {
    overrides.push({
      matcher: { id: matcherId, options: fieldDisplayName, scope: fieldScope },
      properties: [{ id: propId, value: width }],
    });
  }

  props.onFieldConfigChange({
    ...fieldConfig,
    overrides,
  });
}

/**
 * Persists a column reorder as an `organize` transformation, upserting the trailing config rather
 * than appending a new one per drag. Only `indexByName` is written, so the user's own
 * exclude/rename/include options on that config survive.
 *
 * Ownership is by convention: the trailing `organize` is taken to be the one a previous drag wrote.
 * A user who hand-adds an `organize` after it gets that one edited instead, which is a defensible
 * result for a transformation the user owns either way.
 */
export function onColumnReorder(
  displayNames: string[],
  transformations: DataTransformerConfig[],
  onTransformationsChange: (transformations: DataTransformerConfig[]) => void
) {
  const indexByName = Object.fromEntries(displayNames.map((name, index) => [name, index]));
  const last = transformations.at(-1);

  if (last?.id === DataTransformerID.organize) {
    onTransformationsChange([...transformations.slice(0, -1), { ...last, options: { ...last.options, indexByName } }]);

    return;
  }

  // `excludeByName` and `renameByName` are not optional on the transformer's options
  const options: OrganizeFieldsTransformerOptions = {
    indexByName,
    excludeByName: {},
    renameByName: {},
    includeByName: {},
  };

  onTransformationsChange([...transformations, { id: DataTransformerID.organize, options }]);
}

/**
 * Persists a sort change onto the panel options. Generic over the options shape so it can be reused
 * by any panel whose options include a `sortBy` array.
 */
export function onSortByChange<TOptions extends { sortBy?: TableSortByFieldState[] }>(
  sortBy: TableSortByFieldState[],
  props: { options: TOptions; onOptionsChange: (options: TOptions) => void }
) {
  props.onOptionsChange({
    ...props.options,
    sortBy,
  });
}

// placeholder function; assuming the values are already interpolated
const replaceVars: InterpolateFunction = (value: string) => value;

/**
 * Resolves the actions configured on a field for a given row, de-duplicating by title.
 */
export const getCellActions = (
  dataFrame: DataFrame,
  field: Field,
  rowIndex: number,
  replaceVariables: InterpolateFunction | undefined
): Array<ActionModel<Field>> => {
  const numActions = field.config.actions?.length ?? 0;

  if (numActions > 0) {
    const actions = getActions(
      dataFrame,
      field,
      field.state!.scopedVars!,
      replaceVariables ?? replaceVars,
      field.config.actions ?? [],
      { valueRowIndex: rowIndex },
      'table'
    );

    if (actions.length === 1) {
      return actions;
    } else {
      const actionsOut: Array<ActionModel<Field>> = [];
      const actionLookup = new Set<string>();

      actions.forEach((action) => {
        const key = action.title;

        if (!actionLookup.has(key)) {
          actionsOut.push(action);
          actionLookup.add(key);
        }
      });

      return actionsOut;
    }
  }

  return [];
};
