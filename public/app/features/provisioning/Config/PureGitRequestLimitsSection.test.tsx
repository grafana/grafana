import { useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { PureGitRequestLimitsSection } from './PureGitRequestLimitsSection';

interface FormData {
  requestLimits?: {
    maxConcurrent?: number;
    requestsPerSecond?: number;
    burst?: number;
  };
}

function TestForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PureGitRequestLimitsSection<FormData>
        register={register}
        maxConcurrentName="requestLimits.maxConcurrent"
        requestsPerSecondName="requestLimits.requestsPerSecond"
        burstName="requestLimits.burst"
        maxConcurrentError={errors.requestLimits?.maxConcurrent?.message}
        requestsPerSecondError={errors.requestLimits?.requestsPerSecond?.message}
        burstError={errors.requestLimits?.burst?.message}
      />
      <button type="submit">Submit</button>
    </form>
  );
}

describe('PureGitRequestLimitsSection', () => {
  it('submits request limits as numbers', async () => {
    const onSubmit = jest.fn();
    const { user } = render(<TestForm onSubmit={onSubmit} />);

    await user.click(screen.getByText('Request limits'));
    await user.type(screen.getByLabelText(/Maximum concurrent requests/), '2');
    await user.type(screen.getByLabelText(/Requests per second/), '5');
    await user.type(screen.getByLabelText(/^Burst/), '3');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          requestLimits: {
            maxConcurrent: 2,
            requestsPerSecond: 5,
            burst: 3,
          },
        },
        expect.anything()
      )
    );
  });

  it('rejects negative values', async () => {
    const onSubmit = jest.fn();
    const { user } = render(<TestForm onSubmit={onSubmit} />);

    await user.click(screen.getByText('Request limits'));
    await user.type(screen.getByLabelText(/Maximum concurrent requests/), '-1');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Enter zero or a positive integer.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
