import { render, screen } from 'test/test-utils';

import { StepperStateProvider } from '../Wizard/StepperState';
import { StepKey } from '../Wizard/types';
import { type ImportFormValues } from '../types';

import { ReviewStep } from './ReviewStep';

// Only the fields the review reads for a YAML rules import; the rest of the form is irrelevant here.
const yamlRulesFormData = {
  step1Completed: false,
  step1Skipped: true,
  step2Completed: true,
  step2Skipped: false,
  rulesSource: 'yaml',
  rulesYamlFile: new File([''], 'rules.yaml'),
  yamlImportTargetDatasourceUID: 'prom',
  selectedRoutingTree: 'default',
} as unknown as ImportFormValues;

function renderReview(props: Partial<React.ComponentProps<typeof ReviewStep>>) {
  return render(
    <StepperStateProvider initialStep={StepKey.Review}>
      <ReviewStep formData={yamlRulesFormData} onStartImport={jest.fn()} rulesToImport={{}} {...props} />
    </StepperStateProvider>
  );
}

describe('ReviewStep', () => {
  it('shows why the rules file could not be read and does not allow importing it', () => {
    renderReview({ rulesError: new Error('bad yaml') });

    expect(screen.getByText(/could not read the rules file/i)).toBeInTheDocument();
    expect(screen.getByText(/bad yaml/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start import/i })).toBeDisabled();
  });
});
