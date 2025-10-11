import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataTransformerConfig, DataTransformerID } from '@grafana/data';
import { LabelsToFieldsMode, LabelsToFieldsOptions, MergeTransformerOptions } from '@grafana/data/internal';

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

describe('TransformationOperationRowHeader', () => {
  it('renders the modal with the title and empty refId for ', () => {
    const { unmount } = render(
      <TransformationOperationRowHeader
        index={0}
        transformation={mergeTransform}
        transformations={[mergeTransform, labelsToFieldsTransform]}
        transformationTypeName="1 - Labels to fields"
        onChange={() => {}}
      />
    );

    // Check if the modal title is rendered with the correct text
    expect(screen.getByText('1 - Labels to fields')).toBeInTheDocument();
    expect(screen.getByText('(Auto)')).toBeInTheDocument();

    // Unmount the component to clean up
    unmount();
  });

  it('calls onChange when the the refId is changed', async () => {
    const mockOnChange = jest.fn();
    const { unmount } = render(
      <TransformationOperationRowHeader
        index={0}
        transformation={mergeTransform}
        transformations={[mergeTransform, labelsToFieldsTransform]}
        transformationTypeName="1 - Labels to fields"
        onChange={mockOnChange}
        dynamicRefId=""
      />
    );

    // Find and click the modal's close button
    const beforeEditField = screen.getByTestId('transformation-refid-div');
    await userEvent.click(beforeEditField);
    const refIdInput = screen.getByTestId('transformation-refid-input');
    await userEvent.click(refIdInput);
    await userEvent.type(refIdInput, 'test refid');

    // blur the field
    await userEvent.click(document.body);
    expect(mockOnChange).toHaveBeenCalledWith(0, { id: 'merge', options: {}, refId: 'test refid' });

    unmount();
  });

  it('shows an error message if the refID is already used', async () => {
    const mockOnChange = jest.fn();

    const { unmount } = render(
      <TransformationOperationRowHeader
        index={0}
        transformation={mergeTransform}
        transformations={[mergeTransform, labelsToFieldsRefId]}
        transformationTypeName="1 - Labels to fields"
        onChange={mockOnChange}
        dynamicRefId=""
      />
    );

    // Find and click the modal's close button
    const beforeEditField = screen.getByTestId('transformation-refid-div');
    await userEvent.click(beforeEditField);
    const refIdInput = screen.getByTestId('transformation-refid-input');
    await userEvent.click(refIdInput);
    await userEvent.type(refIdInput, 'test');
    expect(screen.getByText('Transformation name already exists')).toBeInTheDocument();
    // blur the field
    await userEvent.click(document.body);
    expect(mockOnChange).not.toHaveBeenCalled();

    unmount();
  });

  it('displays the dynamic id if provided', async () => {
    const { unmount } = render(
      <TransformationOperationRowHeader
        index={0}
        transformation={mergeTransform}
        transformations={[mergeTransform, labelsToFieldsTransform]}
        transformationTypeName="1 - Labels to fields"
        onChange={() => {}}
        dynamicRefId="test-A-B"
      />
    );

    expect(screen.getByText('test-A-B')).toBeInTheDocument();
    unmount();
  });

  it('displays the static id if provided, even if dynamic ref id is also provided', async () => {
    const { unmount } = render(
      <TransformationOperationRowHeader
        index={0}
        transformation={labelsToFieldsRefId}
        transformations={[labelsToFieldsRefId, mergeTransform]}
        transformationTypeName="1 - Labels to fields"
        onChange={() => {}}
        dynamicRefId="refId"
      />
    );

    expect(screen.getByText('test')).toBeInTheDocument();
    unmount();
  });
});
