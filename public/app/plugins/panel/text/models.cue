package grafanaschema

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    mode: "html" | *"markdown" @cuetsy(targetType="enum",withName="TextMode") // TODO This cuetsy attr doesn't exist yet
                    content: string | *"""
                    # Title

                    For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
                    """
                },
                PanelFieldConfig: {}
            }
        ]
    ]
    migrations: []
}
