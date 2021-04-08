package grafanaschema

TextMode: "html" | "markdown" @cuetsy(targetType="enum")

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    mode: TextMode | *"markdown";
                    content: string | `# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
`
                }
            },
        ]
    ]
    migrations: []
}