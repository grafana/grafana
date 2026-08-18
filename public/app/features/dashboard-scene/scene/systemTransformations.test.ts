import { type CustomTransformOperator } from '@grafana/data';
import { type SceneDataTransformation } from '@grafana/scenes';
import { DataTopic } from '@grafana/schema';

import { NO_SYSTEM_TRANSFORMATIONS, getUserTransformations, splitSystemTransformations } from './systemTransformations';

const passthrough: CustomTransformOperator = () => (source) => source;

const systemPrependEntry: SceneDataTransformation = {
  operator: passthrough,
  topic: DataTopic.Series,
  origin: 'system',
  position: 'prepend',
};

const systemAppendEntry: SceneDataTransformation = {
  operator: passthrough,
  topic: DataTopic.Series,
  origin: 'system',
  position: 'append',
};

const userReduce: SceneDataTransformation = { id: 'reduce', options: {} };
const userOrganize: SceneDataTransformation = { id: 'organize', options: {} };

describe('splitSystemTransformations', () => {
  it('returns empty groups for an empty list', () => {
    expect(splitSystemTransformations([])).toEqual({
      systemPrepend: [],
      userTransformations: [],
      systemAppend: [],
    });
  });

  it('treats untagged transformations as user configured', () => {
    expect(splitSystemTransformations([userReduce, userOrganize])).toEqual({
      systemPrepend: [],
      userTransformations: [userReduce, userOrganize],
      systemAppend: [],
    });
  });

  it('groups by position rather than by array index', () => {
    // The two system entries are adjacent, so index alone cannot tell them apart
    expect(splitSystemTransformations([systemPrependEntry, systemAppendEntry])).toEqual({
      systemPrepend: [systemPrependEntry],
      userTransformations: [],
      systemAppend: [systemAppendEntry],
    });
  });

  it('splits a full pipeline into its three groups', () => {
    expect(splitSystemTransformations([systemPrependEntry, userReduce, userOrganize, systemAppendEntry])).toEqual({
      systemPrepend: [systemPrependEntry],
      userTransformations: [userReduce, userOrganize],
      systemAppend: [systemAppendEntry],
    });
  });

  it('defaults a system transformation with no position to prepend', () => {
    const noPosition: SceneDataTransformation = { id: 'reduce', options: {}, origin: 'system' };

    expect(splitSystemTransformations([noPosition]).systemPrepend).toEqual([noPosition]);
  });

  it('treats a bare custom transform operator as user configured', () => {
    // A bare function carries no origin, so it cannot be a system transformation
    expect(splitSystemTransformations([passthrough]).userTransformations).toEqual([passthrough]);
  });
});

describe('getUserTransformations', () => {
  it('drops every system transformation regardless of position', () => {
    expect(getUserTransformations([systemPrependEntry, userReduce, systemAppendEntry])).toEqual([userReduce]);
  });

  it('returns an empty list when only system transformations are installed', () => {
    expect(getUserTransformations([systemPrependEntry, systemAppendEntry])).toEqual([]);
  });
});

describe('NO_SYSTEM_TRANSFORMATIONS', () => {
  it('keeps a stable identity so consumers can use it as an effect dep', () => {
    expect(NO_SYSTEM_TRANSFORMATIONS.prepend).toBe(NO_SYSTEM_TRANSFORMATIONS.prepend);
    expect(NO_SYSTEM_TRANSFORMATIONS.prepend).toEqual([]);
    expect(NO_SYSTEM_TRANSFORMATIONS.append).toEqual([]);
  });
});
