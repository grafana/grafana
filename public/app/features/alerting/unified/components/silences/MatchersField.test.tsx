import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type SilenceFormFields } from 'app/features/alerting/unified/types/silence-form';

import MatchersField from './MatchersField';
import { getDefaultSilenceFormValues } from './utils';

function Wrapper({ rule }: { rule?: { uid: string; title?: string; folderUid?: string } }) {
  const formApi = useForm<SilenceFormFields>({ defaultValues: getDefaultSilenceFormValues() });
  return (
    <FormProvider {...formApi}>
      <MatchersField required={false} rule={rule} />
    </FormProvider>
  );
}

describe('MatchersField', () => {
  it('renders the title supplied by the caller without requesting the rule', () => {
    render(<Wrapper rule={{ uid: 'rule-uid-1', title: 'CPU too high', folderUid: 'folder-1' }} />);

    expect(screen.getByLabelText(/alert rule/i)).toHaveValue('CPU too high');
  });

  it('shows a fallback and no "Alert rule" field lookup failure when the rule has a UID but no title', () => {
    render(<Wrapper rule={{ uid: 'rule-uid-2' }} />);

    expect(screen.getByLabelText(/alert rule/i)).toHaveValue('Unknown alert rule');
  });

  it('renders no "Alert rule" field at all when there is no rule reference', () => {
    render(<Wrapper />);

    expect(screen.queryByLabelText(/alert rule/i)).not.toBeInTheDocument();
  });
});
