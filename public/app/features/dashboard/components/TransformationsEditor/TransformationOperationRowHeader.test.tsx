import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataTransformerConfig, DataTransformerID } from '@grafana/data';
import { LabelsToFieldsMode, type LabelsToFieldsOptions, type MergeTransformerOptions } from '@grafana/data/internal';

import { TransformationOperationRowHeader } from './TransformationOperationRowHeader';

const mergeTransform: DataTransformerConfig<MergeTransformerOptions> = {
  id: DataTransformerID.merge,
  options: {},
};

const labelsToFieldsTransform: DataTransformerConfig<LabelsToFieldsOptions> = {
  id: DataTransformerID.labelsToFields,
  options: {
    mode: LabelsToFieldsMode.Rows,
  },
};

const labelsToFieldsRefId = { ...labelsToFieldsTransform, refId: 'test' };

interface RenderOptions {
  transformation?: DataTransformerConfig;
  transformations?: DataTransformerConfig[];
  onChange?: (index: number, config: DataTransformerConfig) => void;
  dynamicRefId?: string;
  reservedRefIds?: string[];
}

// dynamicRefId defaults to being set, since the refId editor only renders when it is.
function renderHeader({
  transformation = mergeTransform,
  transformations = [mergeTransform, labelsToFieldsTransform],
  onChange = () => {},
  dynamicRefId = 'merge-A-B',
  reservedRefIds,
}: RenderOptions = {}) {
  return render(
    <TransformationOperationRowHeader
      index={0}
      transformation={transformation}
      transformations={transformations}
      transformationTypeName="1 - Labels to fields"
      onChange={onChange}
      dynamicRefId={dynamicRefId}
      reservedRefIds={reservedRefIds}
    />
  );
}

async function typeRefId(value: string) {
  await userEvent.click(screen.getByTestId('transformation-refid-div'));
  await userEvent.type(screen.getByTestId('transformation-refid-input'), value);
}

describe('TransformationOperationRowHeader', () => {
  it('renders the transformation type name', () => {
    renderHeader();

    expect(screen.getByText('1 - Labels to fields')).toBeInTheDocument();
  });

  it('renders the auto placeholder when no static refId is set', () => {
    renderHeader({ dynamicRefId: '' });

    expect(screen.getByText('(Auto)')).toBeInTheDocument();
  });

  it('hides the refId editor for transformations that do not derive their refId from the input', () => {
    render(
      <TransformationOperationRowHeader
        index={0}
        transformation={mergeTransform}
        transformations={[mergeTransform, labelsToFieldsTransform]}
        transformationTypeName="1 - Labels to fields"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('1 - Labels to fields')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-refid-div')).not.toBeInTheDocument();
    expect(screen.queryByText('(Auto)')).not.toBeInTheDocument();
  });

  it('calls onChange when the refId is changed', async () => {
    const onChange = jest.fn();
    renderHeader({ onChange });

    await typeRefId('test refid');
    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith(0, { id: 'merge', options: {}, refId: 'test refid' });
  });

  it('rejects a refId already used by another transformation', async () => {
    const onChange = jest.fn();
    renderHeader({ transformations: [mergeTransform, labelsToFieldsRefId], onChange });

    await typeRefId('test');
    expect(screen.getByText('Transformation name already exists')).toBeInTheDocument();

    await userEvent.click(document.body);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a refId already used by a query or an earlier transformation', async () => {
    const onChange = jest.fn();
    renderHeader({ onChange, reservedRefIds: ['A', 'reduce-A-A'] });

    await typeRefId('A');
    expect(
      screen.getByText('Transformation name is already used by a query or an earlier transformation')
    ).toBeInTheDocument();

    await userEvent.click(document.body);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a refId containing a template variable', async () => {
    const onChange = jest.fn();
    renderHeader({ onChange });

    await typeRefId('$transformName');
    expect(screen.getByText('Transformation name cannot contain a variable')).toBeInTheDocument();

    await userEvent.click(document.body);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('displays the dynamic refId when no static refId is set', () => {
    renderHeader({ dynamicRefId: 'test-A-B' });

    expect(screen.getByText('test-A-B')).toBeInTheDocument();
  });

  it('displays the static refId in preference to the dynamic one', () => {
    renderHeader({
      transformation: labelsToFieldsRefId,
      transformations: [labelsToFieldsRefId, mergeTransform],
      dynamicRefId: 'labelsToFields-A-B',
    });

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.queryByText('labelsToFields-A-B')).not.toBeInTheDocument();
  });
});
