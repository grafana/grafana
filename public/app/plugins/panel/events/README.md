# Events Panel

A specialized panel for displaying events with custom formatting.

## Features

- **Alert Type Column**: Shows colored circles based on severity (unknown, info, warning, error)
- **Message Column**: Displays the event message with emphasis
- **Time Column**: Shows formatted timestamps from `oodle_event_time_epoch_ms`
- **Tags**: All other fields are displayed as label:value pairs

## Expected Data Format

The panel expects data with the following fields:
- `alert_type`: The severity level (unknown, info, warning, error)
- `msg_title`: The event message
- `oodle_event_time_epoch_ms`: Timestamp in milliseconds
- Any other fields will be displayed as tags

## Usage

1. Add the Events panel to your dashboard
2. Configure your data source to return the expected fields
3. The panel will automatically format the data according to the event display rules 