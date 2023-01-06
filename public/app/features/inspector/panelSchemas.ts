import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

export async function getPanelSchema(type: string): Promise<monacoType.languages.json.DiagnosticsOptions | undefined> {
  const openapi = hardcoded[type];
  if (!openapi) {
    return undefined; // TODO... generic schema
  }

  return Promise.resolve({
    validate: true,
    schemas: [
      {
        uri: 'http://root-panel.json', // id of the first schema
        fileMatch: ['*'], // associate with our model
        schema: {
          type: 'object',
          properties: {
            id: {
              description: 'if showing all values limit',
              type: 'number',
            },
            gridPos: {
              description: 'if showing all values limit',
              type: 'object',
            },
            type: {
              type: 'string',
              pattern: type,
            },
            pluginVersion: {
              type: 'string',
              description: 'this gets bumped whenever the panel is saved',
            },
            title: {
              type: 'string',
            },
            options: {
              $ref: `http://panel-${type}.json/#/components/schemas/${type}/properties/PanelOptions`,
            },
          },
          additionalProperties: false,
        },
      },
      {
        uri: `http://panel-${type}.json`,
        schema: openapi,
      },
      {
        uri: 'http://dashboard.json',
        schema: dashboard,
      },
    ],
  });
}

// Hardcoded, but could be loaded from grok:
// eslint-ignore
const hardcoded: Record<string, any> = {
  // https://raw.githubusercontent.com/grafana/grok/main/jsonschema/kinds/composable/news/panel/x/news_types_gen.json

  news: {
    openapi: '3.0.0',
    info: {
      title: 'news',
      version: '0.0',
    },
    paths: {},
    components: {
      schemas: {
        news: {
          type: 'object',
          required: ['PanelOptions'],
          properties: {
            PanelOptions: {
              type: 'object',
              properties: {
                feedUrl: {
                  description: 'empty/missing will default to grafana blog',
                  type: 'string',
                },
                showImage: {
                  type: 'boolean',
                  default: true,
                },
              },
              additionalProperties: false,
            },
          },
          $schema: 'http://json-schema.org/draft-04/schema#',
        },
      },
    },
  },

  //https://raw.githubusercontent.com/grafana/grok/main/jsonschema/kinds/composable/text/panel/x/text_types_gen.json?token=GHSAT0AAAAAABXVD7INKYCZEKOYMAMWBXIOY5YUVOQ
  text: {
    openapi: '3.0.0',
    info: {
      title: 'text',
      version: '0.0',
    },
    paths: {},
    components: {
      schemas: {
        CodeLanguage: {
          type: 'string',
          enum: ['plaintext', 'yaml', 'xml', 'typescript', 'sql', 'go', 'markdown', 'html', 'json'],
          default: 'plaintext',
          $schema: 'http://json-schema.org/draft-04/schema#',
        },
        CodeOptions: {
          type: 'object',
          required: ['language', 'showLineNumbers', 'showMiniMap'],
          properties: {
            language: {
              $ref: '#/components/schemas/CodeLanguage',
            },
            showLineNumbers: {
              type: 'boolean',
              default: false,
            },
            showMiniMap: {
              type: 'boolean',
              default: false,
            },
          },
          $schema: 'http://json-schema.org/draft-04/schema#',
        },
        TextMode: {
          type: 'string',
          enum: ['html', 'markdown', 'code'],
          $schema: 'http://json-schema.org/draft-04/schema#',
        },
        text: {
          type: 'object',
          required: ['TextMode', 'CodeLanguage', 'CodeOptions', 'PanelOptions'],
          properties: {
            TextMode: {
              type: 'string',
              enum: ['html', 'markdown', 'code'],
            },
            CodeLanguage: {
              type: 'string',
              enum: ['plaintext', 'yaml', 'xml', 'typescript', 'sql', 'go', 'markdown', 'html', 'json'],
              default: 'plaintext',
            },
            CodeOptions: {
              type: 'object',
              required: ['language', 'showLineNumbers', 'showMiniMap'],
              properties: {
                language: {
                  $ref: '#/components/schemas/CodeLanguage',
                },
                showLineNumbers: {
                  type: 'boolean',
                  default: false,
                },
                showMiniMap: {
                  type: 'boolean',
                  default: false,
                },
              },
            },
            PanelOptions: {
              type: 'object',
              required: ['mode', 'content'],
              properties: {
                mode: {
                  $ref: '#/components/schemas/TextMode',
                },
                code: {
                  $ref: '#/components/schemas/CodeOptions',
                },
                content: {
                  type: 'string',
                  default: '# Title\n\nFor markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)',
                },
              },
              additionalProperties: false,
            },
          },
          $schema: 'http://json-schema.org/draft-04/schema#',
        },
      },
    },
  },
};

const dashboard = {
  openapi: '3.0.0',
  info: {
    title: 'dashboard',
    version: '0.0',
  },
  paths: {},
  components: {
    schemas: {
      AnnotationQuery: {
        description: 'TODO docs\nFROM: AnnotationQuery in grafana-data/src/types/annotations.ts',
        type: 'object',
        required: ['datasource', 'enable', 'builtIn', 'type', 'showIn'],
        properties: {
          datasource: {
            description: 'Datasource to use for annotation.',
            type: 'object',
            properties: {
              type: {
                type: 'string',
              },
              uid: {
                type: 'string',
              },
            },
          },
          enable: {
            description: 'Whether annotation is enabled.',
            type: 'boolean',
            default: true,
          },
          name: {
            description: 'Name of annotation.',
            type: 'string',
          },
          builtIn: {
            type: 'integer',
            minimum: 0,
            maximum: 255,
            default: 0,
          },
          hide: {
            description: 'Whether to hide annotation.',
            type: 'boolean',
            default: false,
          },
          iconColor: {
            description: 'Annotation icon color.',
            type: 'string',
          },
          type: {
            type: 'string',
            default: 'dashboard',
          },
          rawQuery: {
            description: 'Query for annotation data.',
            type: 'string',
          },
          showIn: {
            type: 'integer',
            minimum: 0,
            maximum: 255,
            default: 0,
          },
          target: {
            $ref: '#/components/schemas/AnnotationTarget',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      AnnotationTarget: {
        description: 'TODO docs',
        type: 'object',
        required: ['limit', 'matchAny', 'tags', 'type'],
        properties: {
          limit: {
            type: 'integer',
            format: 'int64',
          },
          matchAny: {
            type: 'boolean',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          type: {
            type: 'string',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      DashboardCursorSync: {
        description:
          '0 for no shared crosshair or tooltip (default).\n1 for shared crosshair.\n2 for shared crosshair AND shared tooltip.',
        type: 'integer',
        enum: [0, 1, 2],
        default: 0,
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      DashboardLink: {
        description: 'FROM public/app/features/dashboard/state/DashboardModels.ts - ish\nTODO docs',
        type: 'object',
        required: ['title', 'type', 'tags', 'asDropdown', 'targetBlank', 'includeVars', 'keepTime'],
        properties: {
          title: {
            type: 'string',
          },
          type: {
            $ref: '#/components/schemas/DashboardLinkType',
          },
          icon: {
            type: 'string',
          },
          tooltip: {
            type: 'string',
          },
          url: {
            type: 'string',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          asDropdown: {
            type: 'boolean',
            default: false,
          },
          targetBlank: {
            type: 'boolean',
            default: false,
          },
          includeVars: {
            type: 'boolean',
            default: false,
          },
          keepTime: {
            type: 'boolean',
            default: false,
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      DashboardLinkType: {
        description: 'TODO docs',
        type: 'string',
        enum: ['link', 'dashboards'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      DynamicConfigValue: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            default: '',
          },
          value: {},
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      FieldColor: {
        description: 'TODO docs',
        type: 'object',
        required: ['mode'],
        properties: {
          mode: {
            description: 'The main color scheme mode',
            type: 'string',
            oneOf: [
              {
                enum: ['thresholds', 'palette-classic', 'palette-saturated', 'continuous-GrYlRd', 'fixed'],
              },
              {},
            ],
          },
          fixedColor: {
            description: 'Stores the fixed color value if mode is fixed',
            type: 'string',
          },
          seriesBy: {
            $ref: '#/components/schemas/FieldColorSeriesByMode',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      FieldColorModeId: {
        description: 'TODO docs',
        type: 'string',
        enum: ['thresholds', 'palette-classic', 'palette-saturated', 'continuous-GrYlRd', 'fixed'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      FieldColorSeriesByMode: {
        description: 'TODO docs',
        type: 'string',
        enum: ['min', 'max', 'last'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      FieldConfig: {
        type: 'object',
        properties: {
          displayName: {
            description: 'The display value for this field.  This supports template variables blank is auto',
            type: 'string',
          },
          displayNameFromDS: {
            description:
              'This can be used by data sources that return and explicit naming structure for values and labels\nWhen this property is configured, this value is used rather than the default naming strategy.',
            type: 'string',
          },
          description: {
            description: 'Human readable field metadata',
            type: 'string',
          },
          path: {
            description:
              'An explicit path to the field in the datasource.  When the frame meta includes a path,\nThis will default to `${frame.meta.path}/${field.name}\n\nWhen defined, this value can be used as an identifier within the datasource scope, and\nmay be used to update the results',
            type: 'string',
          },
          writeable: {
            description: 'True if data source can write a value to the path.  Auth/authz are supported separately',
            type: 'boolean',
          },
          filterable: {
            description: 'True if data source field supports ad-hoc filters',
            type: 'boolean',
          },
          unit: {
            description: 'Numeric Options',
            type: 'string',
          },
          decimals: {
            description: 'Significant digits (for display)',
            type: 'number',
          },
          min: {
            type: 'number',
          },
          max: {
            type: 'number',
          },
          mappings: {
            description: 'Convert input values into a display string',
            type: 'array',
            items: {
              $ref: '#/components/schemas/ValueMapping',
            },
          },
          thresholds: {
            $ref: '#/components/schemas/ThresholdsConfig',
          },
          color: {
            $ref: '#/components/schemas/FieldColor',
          },
          links: {
            description: 'The behavior when clicking on a result',
            type: 'array',
            items: {},
          },
          noValue: {
            description: 'Alternative to empty string',
            type: 'string',
          },
          custom: {
            description: 'custom is specified by the PanelFieldConfig field\nin panel plugin schemas.',
            type: 'object',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      FieldConfigSource: {
        type: 'object',
        required: ['defaults', 'overrides'],
        properties: {
          defaults: {
            $ref: '#/components/schemas/FieldConfig',
          },
          overrides: {
            type: 'array',
            items: {
              type: 'object',
              required: ['matcher', 'properties'],
              properties: {
                matcher: {
                  $ref: '#/components/schemas/MatcherConfig',
                },
                properties: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/DynamicConfigValue',
                  },
                },
              },
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      GraphPanel: {
        description: 'Support for legacy graph and heatmap panels.',
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['graph'],
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      GridPos: {
        type: 'object',
        required: ['h', 'w', 'x', 'y'],
        properties: {
          h: {
            description: 'Panel',
            type: 'integer',
            minimum: 0,
            exclusiveMinimum: true,
            maximum: 4294967295,
            default: 9,
          },
          w: {
            description: 'Panel',
            type: 'integer',
            minimum: 0,
            exclusiveMinimum: true,
            maximum: 24,
            default: 12,
          },
          x: {
            description: 'Panel x',
            type: 'integer',
            minimum: 0,
            maximum: 24,
            exclusiveMaximum: true,
            default: 0,
          },
          y: {
            description: 'Panel y',
            type: 'integer',
            minimum: 0,
            maximum: 4294967295,
            default: 0,
          },
          static: {
            description: 'true if fixed',
            type: 'boolean',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      HeatmapPanel: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['heatmap'],
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      MappingType: {
        description: 'TODO docs',
        type: 'string',
        enum: ['value', 'range', 'regex', 'special'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      MatcherConfig: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            default: '',
          },
          options: {},
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      Panel: {
        description:
          'Dashboard panels. Panels are canonically defined inline\nbecause they share a version timeline with the dashboard\nschema; they do not evolve independently.',
        type: 'object',
        required: ['type', 'transparent', 'repeatDirection', 'transformations', 'options', 'fieldConfig'],
        properties: {
          type: {
            description: 'The panel plugin type id. May not be empty.',
            type: 'string',
            minLength: 1,
          },
          id: {
            description: 'TODO docs',
            type: 'integer',
            minimum: 0,
            maximum: 4294967295,
          },
          pluginVersion: {
            description: 'FIXME this almost certainly has to be changed in favor of scuemata versions',
            type: 'string',
          },
          tags: {
            description: 'TODO docs',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          targets: {
            description: 'TODO docs',
            type: 'array',
            items: {
              $ref: '#/components/schemas/Target',
            },
          },
          title: {
            description: 'Panel title.',
            type: 'string',
          },
          description: {
            description: 'Description.',
            type: 'string',
          },
          transparent: {
            description: 'Whether to display the panel without a background.',
            type: 'boolean',
            default: false,
          },
          datasource: {
            description: 'The datasource used in all targets.',
            type: 'object',
            properties: {
              type: {
                type: 'string',
              },
              uid: {
                type: 'string',
              },
            },
          },
          gridPos: {
            $ref: '#/components/schemas/GridPos',
          },
          links: {
            description: 'Panel links.\nTODO fill this out - seems there are a couple variants?',
            type: 'array',
            items: {
              $ref: '#/components/schemas/DashboardLink',
            },
          },
          repeat: {
            description: 'Name of template variable to repeat for.',
            type: 'string',
          },
          repeatDirection: {
            description: 'Direction to repeat in if \'repeat\' is set.\n"h" for horizontal, "v" for vertical.',
            type: 'string',
            enum: ['h', 'v'],
            default: 'h',
          },
          maxDataPoints: {
            description: 'TODO docs',
            type: 'number',
          },
          thresholds: {
            description: 'TODO docs - seems to be an old field from old dashboard alerts?',
            type: 'array',
            items: {},
          },
          timeRegions: {
            description: 'TODO docs',
            type: 'array',
            items: {},
          },
          transformations: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Transformation',
            },
          },
          interval: {
            description: 'TODO docs\nTODO tighter constraint',
            type: 'string',
          },
          timeFrom: {
            description: 'TODO docs\nTODO tighter constraint',
            type: 'string',
          },
          timeShift: {
            description: 'TODO docs\nTODO tighter constraint',
            type: 'string',
          },
          options: {
            description: 'options is specified by the PanelOptions field in panel\nplugin schemas.',
            type: 'object',
          },
          fieldConfig: {
            $ref: '#/components/schemas/FieldConfigSource',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      RangeMap: {
        description: 'TODO docs',
        type: 'object',
        required: ['type', 'options'],
        properties: {
          type: {
            type: 'string',
            allOf: [
              {
                $ref: '#/components/schemas/MappingType',
              },
              {
                enum: ['range'],
              },
            ],
          },
          options: {
            type: 'object',
            required: ['from', 'to', 'result'],
            properties: {
              from: {
                description: 'to and from are `number | null` in current ts, really not sure what to do',
                type: 'number',
                format: 'double',
              },
              to: {
                type: 'number',
                format: 'double',
              },
              result: {
                $ref: '#/components/schemas/ValueMappingResult',
              },
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      RegexMap: {
        description: 'TODO docs',
        type: 'object',
        required: ['type', 'options'],
        properties: {
          type: {
            type: 'string',
            allOf: [
              {
                $ref: '#/components/schemas/MappingType',
              },
              {
                enum: ['regex'],
              },
            ],
          },
          options: {
            type: 'object',
            required: ['pattern', 'result'],
            properties: {
              pattern: {
                type: 'string',
              },
              result: {
                $ref: '#/components/schemas/ValueMappingResult',
              },
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      RowPanel: {
        description: 'Row panel',
        type: 'object',
        required: ['type', 'collapsed', 'id', 'panels'],
        properties: {
          type: {
            type: 'string',
            enum: ['row'],
          },
          collapsed: {
            type: 'boolean',
            default: false,
          },
          title: {
            type: 'string',
          },
          datasource: {
            description: 'Name of default datasource.',
            type: 'object',
            properties: {
              type: {
                type: 'string',
              },
              uid: {
                type: 'string',
              },
            },
          },
          gridPos: {
            $ref: '#/components/schemas/GridPos',
          },
          id: {
            type: 'integer',
            minimum: 0,
            maximum: 4294967295,
          },
          panels: {
            type: 'array',
            items: {
              type: 'object',
              oneOf: [
                {
                  $ref: '#/components/schemas/Panel',
                },
                {
                  $ref: '#/components/schemas/GraphPanel',
                },
                {
                  $ref: '#/components/schemas/HeatmapPanel',
                },
              ],
            },
          },
          repeat: {
            description: 'Name of template variable to repeat for.',
            type: 'string',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      SpecialValueMap: {
        description: 'TODO docs',
        type: 'object',
        required: ['type', 'options'],
        properties: {
          type: {
            type: 'string',
            allOf: [
              {
                $ref: '#/components/schemas/MappingType',
              },
              {
                enum: ['special'],
              },
            ],
          },
          options: {
            type: 'object',
            required: ['match', 'pattern', 'result'],
            properties: {
              match: {
                type: 'string',
                enum: ['true', 'false'],
              },
              pattern: {
                type: 'string',
              },
              result: {
                $ref: '#/components/schemas/ValueMappingResult',
              },
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      SpecialValueMatch: {
        description: 'TODO docs',
        type: 'string',
        enum: ['true', 'false', 'null', 'nan', 'null+nan', 'empty'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      Target: {
        description:
          'Schema for panel targets is specified by datasource\nplugins. We use a placeholder definition, which the Go\nschema loader either left open/as-is with the Base\nvariant of the Dashboard and Panel families, or filled\nwith types derived from plugins in the Instance variant.\nWhen working directly from CUE, importers can extend this\ntype directly to achieve the same effect.',
        type: 'object',
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      Threshold: {
        description: 'TODO docs',
        type: 'object',
        required: ['color'],
        properties: {
          value: {
            description:
              'TODO docs\nFIXME the corresponding typescript field is required/non-optional, but nulls currently appear here when serializing -Infinity to JSON',
            type: 'number',
          },
          color: {
            description: 'TODO docs',
            type: 'string',
          },
          state: {
            description:
              'TODO docs\nTODO are the values here enumerable into a disjunction?\nSome seem to be listed in typescript comment',
            type: 'string',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      ThresholdsConfig: {
        type: 'object',
        required: ['mode', 'steps'],
        properties: {
          mode: {
            $ref: '#/components/schemas/ThresholdsMode',
          },
          steps: {
            description: "Must be sorted by 'value', first value is always -Infinity",
            type: 'array',
            items: {
              $ref: '#/components/schemas/Threshold',
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      ThresholdsMode: {
        type: 'string',
        enum: ['absolute', 'percentage'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      Transformation: {
        description:
          "TODO docs\nFIXME this is extremely underspecfied; wasn't obvious which typescript types corresponded to it",
        type: 'object',
        required: ['id', 'options'],
        properties: {
          id: {
            type: 'string',
          },
          options: {
            type: 'object',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      ValueMap: {
        description: 'TODO docs',
        type: 'object',
        required: ['type', 'options'],
        properties: {
          type: {
            type: 'string',
            allOf: [
              {
                $ref: '#/components/schemas/MappingType',
              },
              {
                enum: ['value'],
              },
            ],
          },
          options: {
            type: 'object',
            additionalProperties: {
              $ref: '#/components/schemas/ValueMappingResult',
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      ValueMapping: {
        description: 'TODO docs',
        type: 'object',
        oneOf: [
          {
            $ref: '#/components/schemas/ValueMap',
          },
          {
            $ref: '#/components/schemas/RangeMap',
          },
          {
            $ref: '#/components/schemas/RegexMap',
          },
          {
            $ref: '#/components/schemas/SpecialValueMap',
          },
        ],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      ValueMappingResult: {
        description: 'TODO docs',
        type: 'object',
        properties: {
          text: {
            type: 'string',
          },
          color: {
            type: 'string',
          },
          icon: {
            type: 'string',
          },
          index: {
            type: 'integer',
            format: 'int32',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      VariableModel: {
        description:
          "FROM: packages/grafana-data/src/types/templateVars.ts\nTODO docs\nTODO what about what's in public/app/features/types.ts?\nTODO there appear to be a lot of different kinds of [template] vars here? if so need a disjunction",
        type: 'object',
        required: ['type', 'name'],
        properties: {
          type: {
            $ref: '#/components/schemas/VariableType',
          },
          name: {
            type: 'string',
          },
          label: {
            type: 'string',
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      VariableType: {
        description:
          'FROM: packages/grafana-data/src/types/templateVars.ts\nTODO docs\nTODO this implies some wider pattern/discriminated union, probably?',
        type: 'string',
        enum: ['query', 'adhoc', 'constant', 'datasource', 'interval', 'textbox', 'custom', 'system'],
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
      dashboard: {
        type: 'object',
        required: ['style', 'editable', 'graphTooltip', 'schemaVersion'],
        properties: {
          id: {
            description:
              'Unique numeric identifier for the dashboard.\nTODO must isolate or remove identifiers local to a Grafana instance...?',
            type: 'integer',
            format: 'int64',
          },
          uid: {
            description: 'Unique dashboard identifier that can be generated by anyone. string (8-40)',
            type: 'string',
          },
          title: {
            description: 'Title of dashboard.',
            type: 'string',
          },
          description: {
            description: 'Description of dashboard.',
            type: 'string',
          },
          gnetId: {
            type: 'string',
          },
          tags: {
            description: 'Tags associated with dashboard.',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          style: {
            description: 'Theme of dashboard.',
            type: 'string',
            enum: ['dark', 'light'],
            default: 'dark',
          },
          timezone: {
            description: 'Timezone of dashboard,',
            type: 'string',
            enum: ['browser', 'utc', ''],
            default: 'browser',
          },
          editable: {
            description: 'Whether a dashboard is editable or not.',
            type: 'boolean',
            default: true,
          },
          graphTooltip: {
            $ref: '#/components/schemas/DashboardCursorSync',
          },
          time: {
            description: 'Time range for dashboard, e.g. last 6 hours, last 7 days, etc',
            type: 'object',
            required: ['from', 'to'],
            properties: {
              from: {
                type: 'string',
                default: 'now-6h',
              },
              to: {
                type: 'string',
                default: 'now',
              },
            },
          },
          timepicker: {
            description:
              'TODO docs\nTODO this appears to be spread all over in the frontend. Concepts will likely need tidying in tandem with schema changes',
            type: 'object',
            required: ['collapse', 'enable', 'hidden', 'refresh_intervals', 'time_options'],
            properties: {
              collapse: {
                description: 'Whether timepicker is collapsed or not.',
                type: 'boolean',
                default: false,
              },
              enable: {
                description: 'Whether timepicker is enabled or not.',
                type: 'boolean',
                default: true,
              },
              hidden: {
                description: 'Whether timepicker is visible or not.',
                type: 'boolean',
                default: false,
              },
              refresh_intervals: {
                description: 'Selectable intervals for auto-refresh.',
                type: 'array',
                items: {
                  type: 'string',
                },
                default: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
              },
              time_options: {
                description: 'TODO docs',
                type: 'array',
                items: {
                  type: 'string',
                },
                default: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
              },
            },
          },
          fiscalYearStartMonth: {
            description: 'TODO docs',
            type: 'integer',
            minimum: 0,
            maximum: 13,
            exclusiveMaximum: true,
          },
          liveNow: {
            description: 'TODO docs',
            type: 'boolean',
          },
          weekStart: {
            description: 'TODO docs',
            type: 'string',
          },
          refresh: {
            description: 'TODO docs',
            oneOf: [
              {
                enum: [false],
              },
              {
                type: 'string',
              },
            ],
          },
          schemaVersion: {
            description:
              "Version of the JSON schema, incremented each time a Grafana update brings\nchanges to said schema.\nTODO this is the existing schema numbering system. It will be replaced by Thema's themaVersion",
            type: 'integer',
            minimum: 0,
            maximum: 65535,
            default: 36,
          },
          version: {
            description: 'Version of the dashboard, incremented each time the dashboard is updated.',
            type: 'integer',
            minimum: 0,
            maximum: 4294967295,
          },
          panels: {
            type: 'array',
            items: {
              type: 'object',
              oneOf: [
                {
                  $ref: '#/components/schemas/Panel',
                },
                {
                  $ref: '#/components/schemas/RowPanel',
                },
                {
                  $ref: '#/components/schemas/GraphPanel',
                },
                {
                  $ref: '#/components/schemas/HeatmapPanel',
                },
              ],
            },
          },
          templating: {
            description: 'TODO docs',
            type: 'object',
            required: ['list'],
            properties: {
              list: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/VariableModel',
                },
              },
            },
          },
          annotations: {
            description: 'TODO docs',
            type: 'object',
            required: ['list'],
            properties: {
              list: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/AnnotationQuery',
                },
              },
            },
          },
          links: {
            description: 'TODO docs',
            type: 'array',
            items: {
              $ref: '#/components/schemas/DashboardLink',
            },
          },
        },
        $schema: 'http://json-schema.org/draft-04/schema#',
      },
    },
  },
};
