import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem } from '../QueryEditorContext';
import { type Transformation } from '../types';

import {
  getStackedItemKey,
  getStackedItemsKey,
  getStackedQueryEditorType,
  isCurrentStackedItem,
  parseStackedItemType,
  type StackedItem,
} from './utils';

const queryA: DataQuery = { refId: 'A', datasource: { type: 'prometheus', uid: 'prom' } };
const queryB: DataQuery = { refId: 'B', datasource: { type: 'prometheus', uid: 'prom' } };
const expressionQuery: DataQuery = { refId: 'C', datasource: { type: '__expr__', uid: '__expr__' } };

const transformation: Transformation = {
  registryItem: undefined,
  transformId: 'organize-0',
  transformConfig: { id: 'organize', options: {} },
};

describe('getStackedItemKey', () => {
  it('joins type and id with a colon', () => {
    expect(getStackedItemKey({ type: QueryEditorType.Query, id: 'A' })).toBe('query:A');
    expect(getStackedItemKey({ type: QueryEditorType.Expression, id: 'C' })).toBe('expression:C');
    expect(getStackedItemKey({ type: QueryEditorType.Transformation, id: 'organize-0' })).toBe(
      'transformation:organize-0'
    );
  });
});

describe('parseStackedItemType', () => {
  it.each([QueryEditorType.Query, QueryEditorType.Expression, QueryEditorType.Transformation])(
    'returns %s as-is when valid',
    (type) => {
      expect(parseStackedItemType(type)).toBe(type);
    }
  );

  it.each([null, '', 'alert', 'unknown', 'QUERY'])('returns null for invalid input: %p', (input) => {
    expect(parseStackedItemType(input)).toBeNull();
  });
});

describe('getStackedQueryEditorType', () => {
  it('returns Expression for expression queries', () => {
    expect(getStackedQueryEditorType(expressionQuery)).toBe(QueryEditorType.Expression);
  });

  it('returns Query for regular data queries', () => {
    expect(getStackedQueryEditorType(queryA)).toBe(QueryEditorType.Query);
  });
});

describe('isCurrentStackedItem', () => {
  const queryItem: StackedEditorItem = { type: QueryEditorType.Query, id: 'A' };
  const expressionItem: StackedEditorItem = { type: QueryEditorType.Expression, id: 'C' };
  const transformationItem: StackedEditorItem = { type: QueryEditorType.Transformation, id: 'organize-0' };

  it('matches a query item against the selected query refId', () => {
    expect(isCurrentStackedItem({ item: queryItem, selectedQueryRefId: 'A' })).toBe(true);
    expect(isCurrentStackedItem({ item: queryItem, selectedQueryRefId: 'B' })).toBe(false);
  });

  it('matches an expression item against the selected query refId', () => {
    expect(isCurrentStackedItem({ item: expressionItem, selectedQueryRefId: 'C' })).toBe(true);
    expect(isCurrentStackedItem({ item: expressionItem, selectedQueryRefId: 'A' })).toBe(false);
  });

  it('matches a transformation item against the selected transformation id only', () => {
    expect(
      isCurrentStackedItem({
        item: transformationItem,
        selectedQueryRefId: 'organize-0',
        selectedTransformationId: 'organize-0',
      })
    ).toBe(true);
    expect(
      isCurrentStackedItem({
        item: transformationItem,
        selectedQueryRefId: 'organize-0',
        selectedTransformationId: 'other-0',
      })
    ).toBe(false);
  });

  it('returns false when no selection is provided', () => {
    expect(isCurrentStackedItem({ item: queryItem })).toBe(false);
    expect(isCurrentStackedItem({ item: transformationItem })).toBe(false);
  });
});

describe('getStackedItemsKey', () => {
  it('produces a stable pipe-joined key from item identities', () => {
    const items: StackedItem[] = [
      { type: QueryEditorType.Query, id: 'A', query: queryA },
      { type: QueryEditorType.Query, id: 'B', query: queryB },
      { type: QueryEditorType.Transformation, id: 'organize-0', transformation },
    ];

    expect(getStackedItemsKey(items)).toBe('query:A|query:B|transformation:organize-0');
  });

  it('preserves order — reordered items produce a different key', () => {
    const ordered: StackedItem[] = [
      { type: QueryEditorType.Query, id: 'A', query: queryA },
      { type: QueryEditorType.Query, id: 'B', query: queryB },
    ];
    const reversed: StackedItem[] = [
      { type: QueryEditorType.Query, id: 'B', query: queryB },
      { type: QueryEditorType.Query, id: 'A', query: queryA },
    ];

    expect(getStackedItemsKey(ordered)).not.toBe(getStackedItemsKey(reversed));
  });

  it('returns an empty string for an empty list', () => {
    expect(getStackedItemsKey([])).toBe('');
  });
});
