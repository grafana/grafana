import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';
import { createUrl } from 'app/features/alerting/unified/utils/url';

import { ConfigurationTrackerDrawer } from './ConfigurationTrackerDrawer';

export interface EssentialsProps {
  onClose: () => void;
  essentialsConfig: SectionsDto;
}

export function Essentials({ onClose, essentialsConfig }: EssentialsProps) {
  return (
    <ConfigurationTrackerDrawer
      title="Essentials"
      subtitle="Complete basic recommended configuration to start using apps basic features"
      onClose={onClose}
    >
      <EssentialContent essentialContent={essentialsConfig} />
    </ConfigurationTrackerDrawer>
  );
}
export interface StepButtonDto {
  type: 'openLink' | 'dropDown';
  url: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  done?: boolean;
}
export interface SectionDto {
  title: string;
  description: string;
  steps: Array<{
    title: string;
    description: string;
    button: StepButtonDto;
  }>;
}
export interface SectionsDto {
  sections: SectionDto[];
}

function EssentialContent({ essentialContent }: { essentialContent: SectionsDto }) {
  return (
    <>
      {essentialContent.sections.map((section: SectionDto) => (
        <Section key={section.title} section={section} />
      ))}
    </>
  );
}

function Section({ section }: { section: SectionDto }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Text element="h4">{section.title}</Text>

      <Text color="secondary">{section.description}</Text>
      <Stack direction={'column'} gap={2}>
        {section.steps.map((step, index) => (
          <Step key={index} step={step} />
        ))}
      </Stack>
    </div>
  );
}

function Step({ step }: { step: SectionDto['steps'][0] }) {
  return (
    <Stack direction={'row'} justifyContent={'space-between'}>
      <Stack direction={'row'} alignItems="center">
        {step.button.done ? <Icon name="check-circle" color="green" /> : <Icon name="circle" />}
        <Text variant="body">{step.title}</Text>
        <Icon name="question-circle" />
      </Stack>
      {!step.button.done && <StepButton {...step.button} />}
    </Stack>
  );
}

function StepButton({ type, url, label, options }: StepButtonDto) {
  const urlToGo = createUrl(url, {
    returnTo: location.pathname + location.search,
  });
  function onIntegrationClick(integrationId: string) {
    const urlToGoWithIntegration = createUrl(url + integrationId, {
      returnTo: location.pathname + location.search,
    });
    locationService.push(urlToGoWithIntegration);
  }
  switch (type) {
    case 'openLink':
      return (
        <LinkButton href={urlToGo} variant="secondary">
          {label}
        </LinkButton>
      );
    case 'dropDown':
      return (
        <Dropdown
          overlay={
            <Menu>
              {options?.map((option) => (
                <Menu.Item label={option.label} onClick={() => onIntegrationClick(option.value)} key={option.label} />
              ))}
            </Menu>
          }
        >
          <Button variant="secondary" size="md">
            {label}
            <Icon name="angle-down" />
          </Button>
        </Dropdown>
      );
  }
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      margin: theme.spacing(2, 0),
      padding: theme.spacing(2),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
};
