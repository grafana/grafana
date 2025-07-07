import { Advisor } from '../Advisors.types';

export const AdvisorsService = {
  async list(): Promise<{ advisors: Advisor[] }> {
    return {
      advisors: [
        {
          name: 'cve_security',
          description: 'Informing users about versions of DBs  affected by CVE.',
          summary: 'CVE security',
          category: 'security',
          comment: 'Informing users',
          checks: [
            {
              name: 'mongodb_cve_version',
              description:
                'This check returns errors if MongoDB or Percona Server for MongoDB version is less than the latest one with CVE fixes.',
              summary: 'MongoDB CVE Version',
              interval: 'RARE',
              enabled: true,
            },
          ],
        },
        {
          name: 'version_configuration',
          description:
            'Informs users about new versions of database released to simplify the process of keeping your DB up to date.',
          summary: 'Version configuration',
          category: 'configuration',
          comment: 'Version',
          checks: [
            {
              name: 'mongodb_version',
              enabled: false,
              description:
                'This check returns warnings if MongoDB or Percona Server for MongoDB version is not the latest one.',
              summary: 'MongoDB Version',
              interval: 'FREQUENT',
            },
            {
              name: 'mysql_version',
              enabled: false,
              description:
                'This check returns warnings if MySQL, Percona Server for MySQL, or MariaDB version is not the latest one.',
              summary: 'MySQL Version',
              interval: 'RARE',
            },
            {
              name: 'postgresql_version',
              description:
                'This check returns warnings if PostgreSQL minor version is not the latest one.\nAdditionally notice is returned if PostgreSQL major version is not the latest one.\nError is returned if the major version of PostgreSQL is 9.4 or older.\n',
              summary: 'PostgreSQL Version',
              interval: 'STANDARD',
              enabled: true,
            },
          ],
        },
      ],
    };
  },
};
