import { render, screen } from 'test/test-utils';

import { StepperStateProvider } from '../Wizard/StepperState';
import { StepKey } from '../Wizard/types';
import { type ImportFormValues, type RulesImportSpec } from '../types';

import { ReviewStep } from './ReviewStep';

// Only the fields the review reads for a YAML rules import; the rest of the form is irrelevant here.
const yamlRulesFormData = {
  step1Completed: false,
  step1Skipped: true,
  step2Completed: true,
  step2Skipped: false,
} as unknown as ImportFormValues;

const specSettings = {
  selectedRoutingTree: 'imported',
  targetDatasourceUID: 'prom',
  pauseAlertingRules: true,
  pauseRecordingRules: true,
};
const yamlRulesSpec: RulesImportSpec = {
  ...specSettings,
  type: 'yaml',
  file: new File([''], 'rules.yaml'),
  datasource: { uid: 'prom', name: 'Prometheus' },
};
const dataSourceRulesSpec: RulesImportSpec = {
  ...specSettings,
  type: 'datasource',
  datasource: { uid: 'mimir', name: 'Mimir' },
};

function renderReview(props: Partial<React.ComponentProps<typeof ReviewStep>>) {
  return render(
    <StepperStateProvider initialStep={StepKey.Review}>
      <ReviewStep
        formData={yamlRulesFormData}
        rulesSpec={yamlRulesSpec}
        onStartImport={jest.fn()}
        rulesToImport={{}}
        {...props}
      />
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

  it('shows the file and the data source its rules run against for a YAML import', () => {
    renderReview({});

    expect(screen.getByText('rules.yaml')).toBeInTheDocument();
    expect(screen.getByText('Prometheus')).toBeInTheDocument();
  });

  it('shows the routing, filter, folder and pause settings of the spec', () => {
    renderReview({
      rulesSpec: {
        ...dataSourceRulesSpec,
        namespace: 'ns',
        ruleGroup: 'group',
        targetFolder: { uid: 'folder-uid', title: 'Imported rules' },
        pauseAlertingRules: false,
      },
    });

    expect(screen.getByText(/policy tree: imported/i)).toBeInTheDocument();
    expect(screen.getByText('ns / group')).toBeInTheDocument();
    expect(screen.getByText('Imported rules')).toBeInTheDocument();
    expect(screen.getByText('Recording rules paused')).toBeInTheDocument();
  });

  it('shows only the data source for a data source import', () => {
    renderReview({ rulesSpec: dataSourceRulesSpec });

    expect(screen.getByText('Mimir')).toBeInTheDocument();
    expect(screen.queryByText('rules.yaml')).not.toBeInTheDocument();
  });
});
