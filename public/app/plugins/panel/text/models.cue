package text // must match the plugin id???

TextMode: "html" | "markdown" @cuetsy(targetType="type")

PanelOptions: {
    mode: TextMode | *"markdown"
    content: string | *"""
# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
"""
} @cuetsy(targetType="interface")

