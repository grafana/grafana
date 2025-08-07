import { Box, CollapsableSection, Alert, Space, Text } from '@grafana/ui';

import { InfluxVersion } from '../../../types';

import { AdvancedDbConnectionSettings } from './AdvancedDBConnectionSettings';
import { InfluxFluxDBConnection } from './InfluxFluxDBConnection';
import { InfluxInfluxQLDBConnection } from './InfluxInfluxQLDBConnection';
import { InfluxSQLDBConnection } from './InfluxSQLDBConnection';
import { CONFIG_SECTION_HEADERS } from './constants';
import { Props } from './types';

export const DatabaseConnectionSection = ({ options, onOptionsChange }: Props) => (
  <>
    <Box borderStyle="solid" borderColor="weak" padding={2} marginBottom={4} id={`${CONFIG_SECTION_HEADERS[1].id}`}>
      <CollapsableSection
        label={<Text element="h3">2. {CONFIG_SECTION_HEADERS[1].label}</Text>}
        isOpen={CONFIG_SECTION_HEADERS[1].isOpen}
      >
        {!options.jsonData.version && (
          <Alert severity="info" title="Query language required">
            <p>To view connection settings, first choose a query language in the URL and Connection section.</p>
          </Alert>
        )}
        {options.jsonData.version === InfluxVersion.InfluxQL && (
          <>
            <Alert severity="info" title="Database Access">
              <p>
                Setting the database for this datasource does not deny access to other databases. The InfluxDB query
                syntax allows switching the database in the query. For example:
                <code>SHOW MEASUREMENTS ON _internal</code> or
                <code>SELECT * FROM &quot;_internal&quot;..&quot;database&quot; LIMIT 10</code>
                <br />
                <br />
                To support data isolation and security, make sure appropriate permissions are configured in InfluxDB.
              </p>
            </Alert>
          </>
        )}
        {options.jsonData.version && (
          <>
            <Text color="secondary">
              Provide the necessary database connection details based on your selected InfluxDB product and query
              language.
            </Text>
            <Space v={2} />
          </>
        )}
        <>
          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <InfluxInfluxQLDBConnection options={options} onOptionsChange={onOptionsChange} />
          )}
          {options.jsonData.version === InfluxVersion.Flux && (
            <InfluxFluxDBConnection options={options} onOptionsChange={onOptionsChange} />
          )}
          {options.jsonData.version === InfluxVersion.SQL && (
            <InfluxSQLDBConnection options={options} onOptionsChange={onOptionsChange} />
          )}
          {options.jsonData.version && (
            <AdvancedDbConnectionSettings options={options} onOptionsChange={onOptionsChange} />
          )}
        </>
      </CollapsableSection>
    </Box>
  </>
);
