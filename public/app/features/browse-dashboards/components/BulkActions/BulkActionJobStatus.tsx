import { Trans, t } from '@grafana/i18n';
import { Spinner, Stack, Text, Alert } from '@grafana/ui';
import { Job, useListJobQuery } from 'app/api/clients/provisioning/v0alpha1';
import ProgressBar from 'app/features/provisioning/Shared/ProgressBar';
import { useEffect } from 'react';

interface BulkActionJobStatusProps {
  watch: Job;
  onJobComplete?: (jobState: string, isSuccess: boolean) => void;
  onJobError?: (error: string) => void;
}

export function BulkActionJobStatus({ watch, onJobComplete, onJobError }: BulkActionJobStatusProps) {
  const jobName = watch.metadata?.name;
  console.log('👀 BulkActionJobStatus initialized for job:', jobName);
  
  const activeQuery = useListJobQuery({
    fieldSelector: `metadata.name=${jobName}`,
    watch: true,
  });
  
  console.log('📊 Query state:', {
    isLoading: activeQuery.isLoading,
    isError: activeQuery.isError,
    isFetching: activeQuery.isFetching,
    isUninitialized: activeQuery.isUninitialized,
    data: activeQuery.data
  });
  
  const activeJob = activeQuery?.data?.items?.[0];
  const jobStatus = activeJob?.status;
  const jobState = jobStatus?.state;
  
  console.log('🔄 Current job data:', {
    jobName,
    activeJob,
    jobStatus,
    jobState,
    progress: jobStatus?.progress,
    message: jobStatus?.message,
    errors: jobStatus?.errors
  });

  // Calculate progress based on job state and any provided progress
  const getProgressValue = () => {
    if (jobStatus?.progress !== undefined && jobStatus.progress > 0) {
      return jobStatus.progress;
    }
    
    // Fallback progress based on state
    switch (jobState) {
      case 'pending':
        return 10;
      case 'working':
        return 50;
      case 'success':
        return 100;
      case 'error':
        return 0;
      default:
        return 5;
    }
  };

  // Monitor job completion
  useEffect(() => {
    console.log('🎯 Job state changed:', {
      jobName,
      previousState: 'tracked in logs above',
      currentState: jobState,
      jobStatus
    });
    
    if (jobState === 'success') {
      console.log('🎉 Job completed successfully!', {
        jobName,
        finalStatus: jobStatus,
        summary: jobStatus?.summary
      });
      onJobComplete?.(jobState, true);
    } else if (jobState === 'error') {
      const errors = jobStatus?.errors;
      const message = jobStatus?.message;
      const errorMessage = errors?.length ? errors.join(', ') : message || 'Unknown error';
      console.error('💥 Job failed:', {
        jobName,
        errors,
        message,
        fullStatus: jobStatus
      });
      onJobError?.(errorMessage);
      onJobComplete?.(jobState, false);
    } else if (jobState === 'working') {
      console.log('⚙️ Job is working:', {
        jobName,
        progress: jobStatus?.progress,
        message: jobStatus?.message
      });
    } else if (jobState === 'pending') {
      console.log('⏳ Job is pending:', {
        jobName,
        status: jobStatus
      });
    }
  }, [jobState, jobStatus, onJobComplete, onJobError, jobName]);

  if (activeQuery.isLoading) {
    console.log('⏳ Rendering loading state for job:', jobName);
    return (
      <Stack direction="column" gap={2}>
        <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
          <Spinner size={24} />
          <Text element="h4" color="secondary">
            <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
          </Text>
        </Stack>
        {/* Show initial progress while loading */}
        <ProgressBar progress={getProgressValue()} topBottomSpacing={1} />
      </Stack>
    );
  }

  if (activeQuery.isError) {
    console.error('❌ Query error for job:', jobName, activeQuery.error);
    return (
      <Alert severity="error" title={t('provisioning.job-status.title.error-fetching-active-job', 'Error fetching active job')}>
        {t('provisioning.job-status.error-fetching-job', 'Unable to fetch job status. Please try refreshing the page.')}
      </Alert>
    );
  }

  if (activeJob) {
    console.log('📋 Rendering active job status for:', jobName, 'State:', jobState);
    return (
      <Stack direction="column" gap={2}>
        {['working', 'pending'].includes(jobState ?? '') && (
          <>
            <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
              <Spinner size={24} />
              <Text element="h4" color="secondary">
                {jobStatus?.message ?? jobState ?? t('provisioning.job-status.starting', 'Starting...')}
              </Text>
            </Stack>
            {/* Always show progress bar for working/pending jobs */}
            <ProgressBar progress={getProgressValue()} topBottomSpacing={1} />
          </>
        )}
        {jobState === 'success' && (
          <Alert severity="success" title={t('browse-dashboards.bulk-action-resources-form.job-success', 'Job completed successfully')}>
            {t('browse-dashboards.bulk-action-resources-form.job-success-message', 'The bulk delete operation has been completed successfully.')}
          </Alert>
        )}
        {jobState === 'error' && (
          <Alert severity="error" title={t('browse-dashboards.bulk-action-resources-form.job-error', 'Job failed')}>
            {jobStatus?.errors?.join(', ') || jobStatus?.message || t('browse-dashboards.bulk-action-resources-form.job-error-unknown', 'Unknown error occurred')}
          </Alert>
        )}
      </Stack>
    );
  }

  console.log('🔄 Rendering fallback state (no active job yet) for:', jobName);
  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
        <Spinner size={24} />
        <Text element="h4" weight="bold">
          <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
        </Text>
      </Stack>
      {/* Show a basic progress bar while starting */}
      <ProgressBar progress={getProgressValue()} topBottomSpacing={1} />
    </Stack>
  );
} 