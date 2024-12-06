import { css } from '@emotion/css';
import { Fragment } from 'react';
import { Controller } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Icon, IconName, Input, Switch, Text, useStyles2 } from '@grafana/ui';

interface EnrichmentConfig {
  id: string;
  icon: string;
  name: string;
  description: string;
  detailComponent: string | undefined;
  payload: {
    url: string;
  };
}

const config = {
  enrichments: [
    {
      id: 'enrichments.blocklist',
      icon: 'search',
      name: 'IP Blocklist',
      description: 'Check IPs against blocked lists',
      detailComponent: undefined,
      payload: {
        url: 'http://enrichi.hackathon-2024-12-enrichi.svc.cluster.local:8080/enrich/blocklist',
      },
    },
    {
      id: 'enrichments.ipgeo',
      icon: 'search',
      name: 'IP Geolocation',
      description: 'Check IPs against blocked lists',
      detailComponent: undefined,
      payload: {
        url: '/http://enrichi.hackathon-2024-12-enrichi.svc.cluster.local:8080/enrich/ipgeo',
      },
    },
    {
      id: 'enrichments.sift',
      icon: 'book-open',
      name: 'Sift Investigation',
      description: 'Pull in details from releveant Sift investigations',
      detailComponent: undefined,
      payload: {
        url: 'http://enrichi.hackathon-2024-12-enrichi.svc.cluster.local:8080/enrich/sift',
      },
    },
//    {
//      id: 'enrichments.append-dashboard-images',
//      icon: 'chart-line',
//      name: 'Append Dashboard Images',
//      description: 'Add snapshots of relevant dashboards',
//      detailComponent: undefined,
//      payload: {
//        url: '/enrichment/append-dashboard-images',
//      },
//    },
    {
      id: 'enrichments.dsquery',
      icon: 'question-circle',
      name: 'Grafana Datasource Query',
      description: 'Add a query to lookup and append additional details',
      hasDetails: true,
      detailComponent: 'CustomQueryEnrichmentForm',
      payload: {
        url: 'http://enrichi.hackathon-2024-12-enrichi.svc.cluster.local:8080/enrich/sift',
      },
    },
    {
      id: 'enrichments.custom-url',
      icon: 'question-circle',
      name: 'Custom URL Enrichment',
      description: 'Add your own URL-based enrichment',
      hasDetails: true,
      detailComponent: 'CustomUrlEnrichmentForm',
      payload: {
        url: '/enrichment/custom-enrichment',
      },
    },
  ],
};

interface EnrichmentFormProps {
  control: any;
  register: any;
}

const EnrichmentForm = (props: EnrichmentFormProps) => {
  const { control, register } = props;

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.formWrapper}>
      <Field label="Enrichment configuration" description="Select the enrichments you would like applied.">
        <>
          {config.enrichments.map((enrichment, index) => {
            return (
              <Controller
                render={({ field: { onChange, ref, value, ...field } }) => {
                  return (
                    <div className={styles.enrichmentItem} key={index}>
                      <div className={styles.enrichmentItemBase}>
                        <div className={styles.enrichmentItemIcon}>
                          <Icon name={enrichment.icon as IconName} />
                          <Switch id={enrichment.id} {...register(`${enrichment.id}.active`)} />
                        </div>
                        <div className={styles.enrichmentItemDetails}>
                          <Text>{enrichment.name}</Text>
                          <Text>{enrichment.description}</Text>
                        </div>
                      </div>
                      {value === true && enrichment.detailComponent !== undefined ? (
                        <div className={styles.enrichmentItemForm}>
                          <CustomDetails enrichment={enrichment} control={control} register={register} />
                        </div>
                      ) : null}
                    </div>
                  );
                }}
                control={control}
                name={`${enrichment.id}.active`}
              />
            );
          })}
        </>
      </Field>
    </div>
  );
};

interface CustomDetailProps {
  enrichment: EnrichmentConfig;
  control: any;
  register: any;
}

const CustomDetails = ({ enrichment, control, register }: CustomDetailProps) => {
  switch (enrichment.detailComponent) {
    case 'CustomUrlEnrichmentForm':
      return <CustomUrlEnrichmentForm control={control} register={register} enrichment={enrichment} />;
    case 'CustomQueryEnrichmentForm':
      return <CustomQueryEnrichmentForm control={control} register={register} enrichment={enrichment} />;
    default:
      return null;
  }
};

const CustomUrlEnrichmentForm = ({ enrichment, control, register }: CustomDetailProps) => {
  return (
    <Fragment>
      <Field label="Custom URL" description="Specify the URL to fetch additional data from.">
        <Controller
          render={({ field: { onChange, ref, value, ...field } }) => {
            return <Input placeholder="Enter url..." {...register(`${enrichment.id}.url`)} />;
          }}
          control={control}
          name={`${enrichment.id}.url`}
        />
      </Field>
    </Fragment>
  );
};

const CustomQueryEnrichmentForm = ({ enrichment, control, register }: CustomDetailProps) => {
  return (
    <Fragment>
      <Field label="Loki Query" description="Specify a query to lookup and append additional data to your alert.">
        <Controller
          render={({ field: { onChange, ref, value, ...field } }) => {
            return <Input placeholder="Enter query..." {...register(`${enrichment.id}.query`)} />;
          }}
          control={control}
          name={`${enrichment.id}.query`}
        />
      </Field>
    </Fragment>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  formWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0.5),
  }),
  enrichmentItem: css({
    display: 'flex',
    flexDirection: 'column',
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: `2px`,
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
    margin: theme.spacing(1),
    gap: theme.spacing(1),
    ':hover': {
      cursor: 'pointer',
      border: `solid 1px ${theme.colors.border.strong}`,
    },
  }),
  enrichmentItemBase: css({
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
  }),
  enrichmentItemDetails: css({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginLeft: theme.spacing(3),
  }),
  enrichmentItemIcon: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
  enrichmentItemForm: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: theme.spacing(8),
  }),
});

export { EnrichmentForm };
